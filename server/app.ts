import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { databaseConfigured, db, prepareDatabase } from './db/client.ts';
import { allowedHosts, enableTestUtils, getAuth } from './auth.ts';
import { dataRoutes } from './routes/data.ts';
import { testAuthRoutes } from './routes/test-auth.ts';

// Single Hono app for all /api routes. Served by api/index.ts on Vercel and by the Vite dev middleware locally.
export const app = new Hono().basePath('/api');

// Connect (or, in browser tests, create the in-memory database) before handling any request.
app.use(async (_c, next) => { if (databaseConfigured()) await prepareDatabase(); await next(); });

app.get('/health', async c => {
  let database: 'ok' | 'error' = 'ok';
  try { await db().execute(sql`select 1`); } catch (error) { console.error('Database health check failed', error); database = 'error'; }
  return c.json({ ok: database === 'ok', database }, database === 'ok' ? 200 : 503);
});

// Public, non-secret capabilities so the UI can hide sign-in when no provider is configured.
app.get('/config', c => c.json({ providers: { google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) } }));

// Without a database the app runs guest-only; answer account routes cleanly instead of erroring.
for (const path of ['/auth/*', '/data', '/settings', '/entries', '/entries/*', '/import']) {
  app.use(path, async (c, next) => (databaseConfigured() ? next() : c.json({ error: 'Accounts aren’t configured on this server.' }, 503)));
}

// Better Auth owns everything under /api/auth (sign-in, OAuth callbacks, session, sign-out).
app.on(['GET', 'POST'], '/auth/*', c => getAuth().handler(c.req.raw));

// Reject cross-site writes. Hono's csrf() only inspects form content types, so check every unsafe
// request: browsers always send Origin on these, and Sec-Fetch-Site covers same-origin fallbacks.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const isAllowedOrigin = (origin: string) => { try { return allowedHosts.includes(new URL(origin).host); } catch { return false; } };
app.use(async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next();
  const origin = c.req.header('origin');
  const sameSite = c.req.header('sec-fetch-site') === 'same-origin';
  if (origin ? !isAllowedOrigin(origin) : !sameSite) return c.json({ error: 'Cross-site request blocked.' }, 403);
  return next();
});
app.route('/', dataRoutes);
if (enableTestUtils) app.route('/', testAuthRoutes);

app.notFound(c => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});
