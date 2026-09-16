import { defineConfig } from 'drizzle-kit';

// `drizzle-kit generate` reads only the schema; it never connects to a database.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
