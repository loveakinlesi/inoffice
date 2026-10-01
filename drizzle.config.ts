import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';
import { connectionOptions } from './server/db/client.ts';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
// Migrations use the session (non-pooling) connection; the transaction pooler can't run DDL reliably.
const raw = process.env.POSTGRES_URL_NON_POOLING;
if (!raw) throw new Error('POSTGRES_URL_NON_POOLING is not set. Run `vercel env pull .env.local`.');
const { url, ssl } = connectionOptions(raw);

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './drizzle',
  schemaFilter: ['inoffice'],
  // Keep migration history inside our schema too, so it can't collide with other apps on this database.
  migrations: { schema: 'inoffice', table: '__drizzle_migrations' },
  casing: 'snake_case',
  dbCredentials: { url, ssl },
  strict: true,
});
