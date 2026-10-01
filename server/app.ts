import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { db } from './db/client.ts';
import { auth } from './auth.ts';

// Single Hono app for all /api routes. Served by api/index.ts on Vercel and by the Vite dev middleware locally.
export const app = new Hono().basePath('/api');

app.get('/health', async c => {
  let database: 'ok' | 'error' = 'ok';
  try { await db().execute(sql`select 1`); } catch (error) { console.error('Database health check failed', error); database = 'error'; }
  return c.json({ ok: database === 'ok', database }, database === 'ok' ? 200 : 503);
});

// Public, non-secret capabilities so the UI can hide sign-in when no provider is configured.
app.get('/config', c => c.json({ providers: { google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) } }));

// Better Auth owns everything under /api/auth (sign-in, OAuth callbacks, session, sign-out).
app.on(['GET', 'POST'], '/auth/*', c => auth.handler(c.req.raw));

app.notFound(c => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});
