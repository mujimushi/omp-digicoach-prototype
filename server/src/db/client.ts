import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';

export type Db = NodePgDatabase;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbOrTx = Db | Tx;

export type DatabaseSettings = {
  url: string;
  /** DigitalOcean's CA certificate. When given, the server verifies the database's certificate. */
  caCert?: string | undefined;
  maxConnections?: number;
};

/**
 * Removes any `sslmode` from the URL, so the certificate check can't be switched off by the URL,
 * and passes TLS settings explicitly instead.
 */
export function poolConfig(settings: DatabaseSettings): PoolConfig {
  const url = new URL(settings.url);
  url.searchParams.delete('sslmode');
  return {
    connectionString: url.toString(),
    ssl: settings.caCert
      ? { ca: settings.caCert, rejectUnauthorized: true }
      : undefined,
    max: settings.maxConnections ?? 10,
  };
}

export function createDatabase(settings: DatabaseSettings): {
  db: Db;
  pool: Pool;
} {
  const pool = new Pool(poolConfig(settings));
  // Without a listener, an idle client's network error would crash the process.
  pool.on('error', () => {});
  return { db: drizzle({ client: pool }), pool };
}

/** The same database URL with another database name, such as `omp_test`. */
export function withDatabaseName(databaseUrl: string, name: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}
