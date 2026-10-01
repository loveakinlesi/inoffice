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
/** Lazily created so routes that never touch the database don't need credentials. */
export const db = () => (instance ??= createDb());
/** Tests inject an in-memory database before the first query. */
export const setDatabase = (database: Database) => { instance = database; };
