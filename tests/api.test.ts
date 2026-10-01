import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '../server/db/schema.ts';
import type { Database } from '../server/db/client.ts';

// Auth reads its configuration at import time, so set it before loading any server module.
process.env.AUTH_TEST_UTILS = '1';
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.BETTER_AUTH_URL = 'http://127.0.0.1:5173';

const ORIGIN = 'http://127.0.0.1:5173';
const settings = { attendanceMode: 'percentage', targetPercentage: 60, targetDaysPerWeek: null, region: 'scotland', onboardingComplete: true };

let app: typeof import('../server/app.ts').app;
let getAuth: typeof import('../server/auth.ts').getAuth;

before(async () => {
  // An in-memory Postgres with the real migrations, so tests never touch a shared database.
  const db = drizzle(new PGlite(), { schema, casing: 'snake_case' });
  await migrate(db, { migrationsFolder: './drizzle', migrationsSchema: 'inoffice', migrationsTable: '__drizzle_migrations' });
  (await import('../server/db/client.ts')).setDatabase(db as unknown as Database);
  ({ app } = await import('../server/app.ts'));
  ({ getAuth } = await import('../server/auth.ts'));
});

async function signedInUser(email: string) {
  const { test: helpers } = await getAuth().$context as unknown as { test: {
    createUser(o: object): { id: string }; saveUser(u: object): Promise<{ id: string }>; getAuthHeaders(o: { userId: string }): Promise<Headers>;
  } };
  const user = await helpers.saveUser(helpers.createUser({ email, name: email }));
  const headers = await helpers.getAuthHeaders({ userId: user.id });
  return { id: user.id, headers };
}

function call(path: string, { method = 'GET', headers = new Headers(), body, origin = ORIGIN }: { method?: string; headers?: Headers; body?: unknown; origin?: string | null } = {}) {
  const h = new Headers(headers);
  if (body !== undefined) h.set('content-type', 'application/json');
  if (origin && method !== 'GET') h.set('origin', origin);
  return app.fetch(new Request(`${ORIGIN}/api${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }));
}

test('rejects anonymous requests and keeps unknown routes as 404', async () => {
  assert.equal((await call('/data')).status, 401);
  assert.equal((await call('/settings', { method: 'PUT', body: settings })).status, 401);
  assert.equal((await call('/nope')).status, 404);
  assert.equal((await call('/health')).status, 200);
});

test('settings and entries round-trip with validation', async () => {
  const { headers } = await signedInUser('roundtrip@example.test');
  assert.deepEqual(await (await call('/data', { headers })).json(), { settings: null, entries: {} });

  assert.equal((await call('/settings', { method: 'PUT', headers, body: { ...settings, targetPercentage: 101 } })).status, 400);
  assert.equal((await call('/settings', { method: 'PUT', headers, body: settings })).status, 200);
  assert.equal((await call('/entries/2026-09-08', { method: 'PUT', headers, body: { status: 'office' } })).status, 200);
  assert.equal((await call('/entries/2026-09-08', { method: 'PUT', headers, body: { status: 'home' } })).status, 200);
  assert.equal((await call('/entries/2026-02-30', { method: 'PUT', headers, body: { status: 'office' } })).status, 400);
  assert.equal((await call('/entries/2026-09-09', { method: 'PUT', headers, body: { status: '<script>' } })).status, 400);

  const data = await (await call('/data', { headers })).json();
  assert.deepEqual(data, { settings, entries: { '2026-09-08': 'home' } });

  assert.equal((await call('/entries/2026-09-08', { method: 'DELETE', headers })).status, 204);
  assert.deepEqual((await (await call('/data', { headers })).json()).entries, {});
});

test('month reset only clears the requested month', async () => {
  const { headers } = await signedInUser('month@example.test');
  for (const date of ['2026-08-31', '2026-09-01', '2026-09-30', '2026-10-01']) {
    await call(`/entries/${date}`, { method: 'PUT', headers, body: { status: 'office' } });
  }
  assert.equal((await call('/entries?month=2026-13', { method: 'DELETE', headers })).status, 400);
  assert.equal((await call('/entries?month=2026-09', { method: 'DELETE', headers })).status, 204);
  assert.deepEqual(Object.keys((await (await call('/data', { headers })).json()).entries).sort(), ['2026-08-31', '2026-10-01']);
});

test('users only ever see their own data', async () => {
  const a = await signedInUser('a@example.test');
  const b = await signedInUser('b@example.test');
  await call('/entries/2026-09-08', { method: 'PUT', headers: a.headers, body: { status: 'office' } });
  await call('/entries/2026-09-08', { method: 'DELETE', headers: b.headers });
  await call('/entries?month=2026-09', { method: 'DELETE', headers: b.headers });
  assert.deepEqual((await (await call('/data', { headers: b.headers })).json()).entries, {});
  assert.deepEqual((await (await call('/data', { headers: a.headers })).json()).entries, { '2026-09-08': 'office' });
});

test('import merges on first sign-in and replaces on restore', async () => {
  const { headers } = await signedInUser('import@example.test');
  await call('/settings', { method: 'PUT', headers, body: settings });
  await call('/entries/2026-09-08', { method: 'PUT', headers, body: { status: 'office' } });

  const local = { settings: { ...settings, targetPercentage: 40 }, entries: { '2026-09-08': 'home', '2026-09-09': 'ooo' } };
  assert.equal((await call('/import', { method: 'POST', headers, body: { mode: 'sideways', ...local } })).status, 400);
  assert.equal((await call('/import', { method: 'POST', headers, body: { mode: 'merge', ...local, entries: { '2026-02-30': 'office' } } })).status, 400);

  assert.equal((await call('/import', { method: 'POST', headers, body: { mode: 'merge', ...local } })).status, 204);
  let data = await (await call('/data', { headers })).json();
  assert.equal(data.settings.targetPercentage, 60, 'merge keeps account settings');
  assert.deepEqual(data.entries, { '2026-09-08': 'office', '2026-09-09': 'ooo' }, 'merge keeps account entries and adds new ones');

  assert.equal((await call('/import', { method: 'POST', headers, body: { mode: 'replace', ...local } })).status, 204);
  data = await (await call('/data', { headers })).json();
  assert.equal(data.settings.targetPercentage, 40);
  assert.deepEqual(data.entries, local.entries);
});

test('blocks cross-site writes', async () => {
  const { headers } = await signedInUser('csrf@example.test');
  assert.equal((await call('/settings', { method: 'PUT', headers, body: settings, origin: 'https://evil.example' })).status, 403);
  assert.equal((await call('/data', { method: 'DELETE', headers, origin: null })).status, 403);
});

test('deleting data, and deleting the account, removes attendance', async () => {
  const user = await signedInUser('delete@example.test');
  await call('/settings', { method: 'PUT', headers: user.headers, body: settings });
  await call('/entries/2026-09-08', { method: 'PUT', headers: user.headers, body: { status: 'office' } });
  assert.equal((await call('/data', { method: 'DELETE', headers: user.headers })).status, 204);
  assert.deepEqual(await (await call('/data', { headers: user.headers })).json(), { settings: null, entries: {} });

  await call('/entries/2026-09-08', { method: 'PUT', headers: user.headers, body: { status: 'office' } });
  const ctx = await getAuth().$context as unknown as { test: { deleteUser(id: string): Promise<void> } };
  await ctx.test.deleteUser(user.id);
  const { db } = await import('../server/db/client.ts');
  const { eq } = await import('drizzle-orm');
  assert.equal((await db().select().from(schema.attendanceEntries).where(eq(schema.attendanceEntries.userId, user.id))).length, 0);
});
