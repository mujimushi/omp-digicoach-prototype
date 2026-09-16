import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import type { Config } from './config.ts';
import type { Db } from './db/client.ts';
import { registerAuth } from './plugins/auth.ts';
import { changeRequestGuard } from './plugins/change-guard.ts';
import { errorHandler, sendError } from './plugins/errors.ts';
import { authRoutes } from './routes/auth/index.ts';
import { healthRoutes } from './routes/health.ts';
import { meRoutes } from './routes/me/index.ts';
import { syncRoutes } from './routes/sync/index.ts';

export type BuildAppOptions = {
  config: Config;
  db: Db;
  /** Folder holding the built app. Leave it out in development, where Vite serves the app. */
  appDistDir?: string | undefined;
  logger?: FastifyServerOptions['logger'];
  /** The server's clock. Tests pass a fixed one. */
  now?: () => Date;
  /** Extra routes under /api, after the login checks. Tests only. */
  extraApiRoutes?: (api: FastifyInstance) => Promise<void>;
};

export const LOG_REDACT = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
];

export async function buildApp(
  options: BuildAppOptions,
): Promise<FastifyInstance> {
  const { config, db } = options;
  const app = Fastify({
    logger: options.logger ?? { level: 'info', redact: LOG_REDACT },
    trustProxy: config.trustProxy,
  });

  // 1. Settings and the database.
  app.decorate('config', config);
  app.decorate('db', db);
  app.decorate('now', options.now ?? (() => new Date()));

  // 2. Security headers. Helmet's defaults don't include worker-src or manifest-src.
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        'worker-src': ["'self'"],
        'manifest-src': ["'self'"],
        // Over plain http on a laptop, upgrading requests breaks Safari.
        ...(config.nodeEnv === 'production'
          ? {}
          : { 'upgrade-insecure-requests': null }),
      },
    },
  });

  // 3. Cookies and the login rate limit.
  await app.register(fastifyCookie);
  await app.register(fastifyRateLimit, { global: false });

  // 4. Zod checks on every route, and one error shape.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);

  // 5. The API.
  await app.register(
    async (api) => {
      api.addHook('onRequest', changeRequestGuard);
      registerAuth(api);
      await api.register(healthRoutes);
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(meRoutes, { prefix: '/me' });
      await api.register(syncRoutes, { prefix: '/sync' });
      if (options.extraApiRoutes) await api.register(options.extraApiRoutes);
      // Scoped to /api, so unknown API paths answer JSON even when a browser asks for HTML.
      api.setNotFoundHandler((request, reply) =>
        sendError(
          reply,
          404,
          'not_found',
          `No route for ${request.method} ${request.url}`,
        ),
      );
    },
    { prefix: '/api' },
  );

  // 6. The built app, with page navigations falling back to index.html.
  if (options.appDistDir) {
    await app.register(fastifyStatic, {
      root: options.appDistDir,
      wildcard: false,
    });
    app.setNotFoundHandler((request, reply) => {
      if (
        request.method === 'GET' &&
        request.headers.accept?.includes('text/html')
      ) {
        return reply.type('text/html').sendFile('index.html');
      }
      return sendError(
        reply,
        404,
        'not_found',
        `No route for ${request.method} ${request.url}`,
      );
    });
  }

  return app;
}
