import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { db } from './db/client.ts';

// Single Hono app for all /api routes. Served by api/index.ts on Vercel and by the Vite dev middleware locally.
export const app = new Hono().basePath('/api');

app.get('/health', async c => {
  let database: 'ok' | 'error' = 'ok';
  try { await db().execute(sql`select 1`); } catch (error) { console.error('Database health check failed', error); database = 'error'; }
  return c.json({ ok: database === 'ok', database }, database === 'ok' ? 200 : 503);
});

app.notFound(c => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});
