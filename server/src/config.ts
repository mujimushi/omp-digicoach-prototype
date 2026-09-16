import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** DigitalOcean's CA certificate, so the server verifies the database's certificate. */
  DATABASE_CA_CERT: z.string().min(1).optional(),
  PORT: z.coerce.number().int().min(1).max(65535),
  NODE_ENV: z.enum(['development', 'test', 'production']),
  SESSION_COOKIE_NAME: z.string().min(1).optional(),
  /** The app's own origin, such as https://omp.ondigitalocean.app. Defaults to the request's host. */
  APP_ORIGIN: z.url().optional(),
  /** Login attempts per IP address per 15 minutes. Only end-to-end tests raise it. */
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).optional(),
});

export type Config = {
  databaseUrl: string;
  databaseCaCert: string | undefined;
  port: number;
  nodeEnv: 'development' | 'test' | 'production';
  cookie: { name: string; secure: boolean };
  appOrigin: string | undefined;
  loginRateLimitMax: number;
  /** Behind DigitalOcean's load balancer, the client's address comes from X-Forwarded-For. */
  trustProxy: boolean;
};

export const PRODUCTION_COOKIE_NAME = '__Host-omp_session';
export const DEVELOPMENT_COOKIE_NAME = 'omp_session';
export const LOGIN_RATE_LIMIT_MAX = 20;

export class ConfigError extends Error {
  override name = 'ConfigError';
}

/** Reads server settings from the environment. Throws a ConfigError naming every missing or invalid value. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const key = String(issue.path[0]);
      return env[key] === undefined
        ? `  ${key} is missing`
        : `  ${key}: ${issue.message}`;
    });
    throw new ConfigError(
      [
        'Server settings are missing or invalid:',
        ...problems,
        'Copy server/.env.example to server/.env and fill in every value.',
      ].join('\n'),
    );
  }

  const values = result.data;
  const production = values.NODE_ENV === 'production';
  const cookieName =
    values.SESSION_COOKIE_NAME ??
    (production ? PRODUCTION_COOKIE_NAME : DEVELOPMENT_COOKIE_NAME);

  if (production && !cookieName.startsWith('__Host-')) {
    throw new ConfigError(
      `SESSION_COOKIE_NAME must start with __Host- in production, so the browser sends it only over HTTPS to this host. Got "${cookieName}".`,
    );
  }
  if (production && values.LOGIN_RATE_LIMIT_MAX !== undefined) {
    throw new ConfigError(
      'LOGIN_RATE_LIMIT_MAX is for end-to-end tests only; leave it unset in production.',
    );
  }

  return {
    databaseUrl: values.DATABASE_URL,
    databaseCaCert: values.DATABASE_CA_CERT,
    port: values.PORT,
    nodeEnv: values.NODE_ENV,
    cookie: { name: cookieName, secure: production },
    appOrigin: values.APP_ORIGIN,
    loginRateLimitMax: values.LOGIN_RATE_LIMIT_MAX ?? LOGIN_RATE_LIMIT_MAX,
    trustProxy: production,
  };
}
