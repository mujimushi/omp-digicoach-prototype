import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  PORT: z.coerce.number().int().min(1).max(65535),
  NODE_ENV: z.enum(['development', 'test', 'production']),
  SESSION_COOKIE_NAME: z.string().min(1),
});

export type Config = z.infer<typeof EnvSchema>;

export class ConfigError extends Error {
  override name = 'ConfigError';
}

/** Reads server settings from the environment. Throws a ConfigError naming every missing or invalid value. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = EnvSchema.safeParse(env);
  if (result.success) return result.data;

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
