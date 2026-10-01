import { drizzle } from 'drizzle-orm/postgres-js';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import * as schema from './schema.ts';

/** Any Drizzle Postgres database with our schema (postgres.js in the app, PGlite in tests). */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * postgres.js forwards unknown URL query parameters (e.g. Supabase's `supa=`) to Postgres as
 * session settings, which the server rejects, so connect without the query string and set SSL here.
 */
export function connectionOptions(url: string) {
  const parsed = new URL(url);
  const ssl = parsed.searchParams.get('sslmode') === 'disable' ? false : 'require' as const;
  parsed.search = '';
  return { url: parsed.toString(), ssl };
}

function createDb(): Database {
  const raw = process.env.POSTGRES_URL;
  if (!raw) throw new Error('POSTGRES_URL is not set. Run `vercel env pull .env.local`.');
  const { url, ssl } = connectionOptions(raw);
  // POSTGRES_URL is Supabase's transaction pooler, which does not support prepared statements.
  const client = postgres(url, { ssl, prepare: false, max: 5 });
  return drizzle(client, { schema, casing: 'snake_case' });
}

let instance: Database | undefined;
let ready: Promise<void> | undefined;

/** Lazily created so routes that never touch the database don't need credentials. */
export const db = () => {
  if (!instance) throw new Error('Database not prepared; call prepareDatabase() first.');
  return instance;
};

/** Whether accounts can work here: a database is configured or has been injected. */
export const databaseConfigured = () => Boolean(instance || process.env.POSTGRES_URL || process.env.TEST_DATABASE);

/** Tests inject an in-memory database before the first query. */
export const setDatabase = (database: Database) => { instance = database; ready = Promise.resolve(); };

/**
 * Creates the database on first use. With TEST_DATABASE=pglite (browser tests), uses an in-memory
 * Postgres with migrations applied, so tests never need credentials or touch a shared database.
 */
export function prepareDatabase() {
  ready ??= (async () => {
    if (process.env.TEST_DATABASE === 'pglite') {
      const [{ PGlite }, { drizzle: drizzlePglite }, { migrate }] = await Promise.all([
        import('@electric-sql/pglite'), import('drizzle-orm/pglite'), import('drizzle-orm/pglite/migrator'),
      ]);
      const memory = drizzlePglite(new PGlite(), { schema, casing: 'snake_case' });
      await migrate(memory, { migrationsFolder: './drizzle', migrationsSchema: 'inoffice', migrationsTable: '__drizzle_migrations' });
      instance = memory as unknown as Database;
    } else {
      instance = createDb();
    }
  })().catch(error => {
    // Leave the database unset (queries fail, other routes still work) and retry on the next request.
    ready = undefined;
    console.error('Database unavailable:', (error as Error).message);
  });
  return ready;
}
