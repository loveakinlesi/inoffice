// Applies pending migrations in ./drizzle using the session (non-pooling) connection.
import { existsSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { connectionOptions } from './client.ts';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const raw = process.env.POSTGRES_URL_NON_POOLING;
if (!raw) throw new Error('POSTGRES_URL_NON_POOLING is not set. Run `vercel env pull .env.local`.');

const { url, ssl } = connectionOptions(raw);
const client = postgres(url, { ssl, max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: './drizzle', migrationsSchema: 'inoffice', migrationsTable: '__drizzle_migrations' });
  console.log('Migrations applied.');
} finally {
  await client.end();
}
