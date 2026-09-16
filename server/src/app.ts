import fastifyStatic from '@fastify/static';
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify';

export type BuildAppOptions = FastifyServerOptions & {
  /** Folder holding the built app. Leave it out in development, where Vite serves the app. */
  appDistDir?: string;
};

export function buildApp({
  appDistDir,
  ...fastifyOptions
}: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: {
      level: 'info',
      redact: ['req.headers.cookie', 'res.headers["set-cookie"]'],
    },
    ...fastifyOptions,
  });

  app.register(apiRoutes, { prefix: '/api' });

  if (appDistDir) {
    app.register(fastifyStatic, { root: appDistDir, wildcard: false });
    // Page navigations to app routes such as /history get index.html; React Router takes over from there.
    app.setNotFoundHandler((request, reply) => {
      if (
        request.method === 'GET' &&
        request.headers.accept?.includes('text/html')
      ) {
        return reply.type('text/html').sendFile('index.html');
      }
      return reply.code(404).send(notFound(request.method, request.url));
    });
  }

  return app;
}

async function apiRoutes(api: FastifyInstance) {
  api.get('/health', async () => ({ ok: true }));

  // Scoped to /api, so unknown API paths answer JSON even when a browser asks for HTML.
  api.setNotFoundHandler((request, reply) => {
    return reply.code(404).send(notFound(request.method, request.url));
  });
}

function notFound(method: string, url: string) {
  return { code: 'not_found', message: `No route for ${method} ${url}` };
}
