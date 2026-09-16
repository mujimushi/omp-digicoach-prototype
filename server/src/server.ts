import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.ts';
import { type Config, ConfigError, loadConfig } from './config.ts';
import { createDatabase } from './db/client.ts';

let config: Config;
try {
  config = loadConfig();
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(error.message);
  process.exit(1);
}

const { db, pool } = createDatabase({
  url: config.databaseUrl,
  caCert: config.databaseCaCert,
});

// In development Vite serves the app; in test and production the server serves the build.
const appDistDir = fileURLToPath(new URL('../../app/dist', import.meta.url));
const serveApp = config.nodeEnv !== 'development' && existsSync(appDistDir);
const app = await buildApp({
  config,
  db,
  appDistDir: serveApp ? appDistDir : undefined,
});

app.log.info(
  {
    databaseTls: config.databaseCaCert
      ? 'verified with DATABASE_CA_CERT'
      : 'off',
    cookie: config.cookie.name,
  },
  'starting',
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app
      .close()
      .then(() => pool.end())
      .then(
        () => process.exit(0),
        () => process.exit(1),
      );
  });
}

try {
  // Containers need every interface; on a laptop, stay on this machine.
  await app.listen({
    port: config.port,
    host: config.nodeEnv === 'production' ? '0.0.0.0' : '127.0.0.1',
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
