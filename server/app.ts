import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { db } from './db/client.ts';
import { allowedHosts, getAuth } from './auth.ts';
import { dataRoutes } from './routes/data.ts';

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

app.notFound(c => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});
