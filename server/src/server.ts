import { fileURLToPath } from 'node:url';
import { buildApp } from './app.ts';
import { type Config, ConfigError, loadConfig } from './config.ts';

let config: Config;
try {
  config = loadConfig();
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(error.message);
  process.exit(1);
}

const production = config.NODE_ENV === 'production';
const appDistDir = fileURLToPath(new URL('../../app/dist', import.meta.url));
const app = buildApp(production ? { appDistDir } : {});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
}

try {
  // Containers need every interface; on a laptop, stay on this machine.
  await app.listen({
    port: config.PORT,
    host: production ? '0.0.0.0' : '127.0.0.1',
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
