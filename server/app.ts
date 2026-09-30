import { Hono } from 'hono';

// Single Hono app for all /api routes. Served by api/index.ts on Vercel and by the Vite dev middleware locally.
export const app = new Hono().basePath('/api');

app.get('/health', c => c.json({ ok: true }));

app.notFound(c => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});
