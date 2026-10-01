import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { createMiddleware } from 'hono/factory';
import { and, eq, gte, lt } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { attendanceEntries, userSettings } from '../db/schema.ts';
import { getAuth, type Session } from '../auth.ts';
import { STATUS_ORDER } from '../../src/lib/constants.ts';
import { validDate, validEntries, validSettings } from '../../src/lib/validation.ts';
import type { Entries, Settings, Status } from '../../src/lib/types.ts';

type Env = { Variables: { user: Session['user'] } };

/** Larger than any realistic history (a decade is ~2,600 weekdays) while bounding import cost. */
const MAX_IMPORT_ENTRIES = 20_000;
const json400 = (message: string) => ({ error: message });

const toSettings = (row: typeof userSettings.$inferSelect): Settings => ({
  attendanceMode: row.attendanceMode,
  targetPercentage: row.targetPercentage,
  targetDaysPerWeek: row.targetDaysPerWeek,
  region: row.region,
  onboardingComplete: row.onboardingComplete,
});

const settingsValues = (userId: string, s: Settings) => ({
  userId,
  attendanceMode: s.attendanceMode,
  targetPercentage: s.targetPercentage,
  targetDaysPerWeek: s.targetDaysPerWeek,
  region: s.region,
  onboardingComplete: s.onboardingComplete,
});

async function readJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { return undefined; }
}

export const dataRoutes = new Hono<Env>();

// Every data route requires a signed-in user; queries below are always scoped to that user's id.
const requireUser = createMiddleware<Env>(async (c, next) => {
  const session = await getAuth().api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json(json400('Sign in to continue.'), 401);
  c.set('user', session.user);
  await next();
});
// Scoped to these paths so unknown /api routes still 404 rather than 401.
for (const path of ['/data', '/settings', '/entries', '/entries/*', '/import']) dataRoutes.use(path, requireUser);

/** Everything the client needs to render: settings (null until first saved) and all entries. */
dataRoutes.get('/data', async c => {
  const userId = c.get('user').id;
  const [settingsRow] = await db().select().from(userSettings).where(eq(userSettings.userId, userId));
  const rows = await db().select({ date: attendanceEntries.date, status: attendanceEntries.status })
    .from(attendanceEntries).where(eq(attendanceEntries.userId, userId));
  const entries: Entries = Object.fromEntries(rows.map(r => [r.date, r.status]));
  return c.json({ settings: settingsRow ? toSettings(settingsRow) : null, entries });
});

dataRoutes.put('/settings', async c => {
  const body = await readJson(c.req.raw);
  if (!validSettings(body)) return c.json(json400('Invalid settings.'), 400);
  const values = settingsValues(c.get('user').id, body);
  await db().insert(userSettings).values(values).onConflictDoUpdate({ target: userSettings.userId, set: values });
  return c.json({ settings: toSettings({ ...values, updatedAt: new Date() }) });
});

dataRoutes.put('/entries/:date', async c => {
  const date = c.req.param('date');
  const body = await readJson(c.req.raw) as { status?: unknown } | undefined;
  if (!validDate(date)) return c.json(json400('Invalid date.'), 400);
  if (!STATUS_ORDER.includes(body?.status as Status)) return c.json(json400('Invalid status.'), 400);
  const status = body!.status as Status;
  const userId = c.get('user').id;
  await db().insert(attendanceEntries).values({ userId, date, status })
    .onConflictDoUpdate({ target: [attendanceEntries.userId, attendanceEntries.date], set: { status } });
  return c.json({ date, status });
});

dataRoutes.delete('/entries/:date', async c => {
  const date = c.req.param('date');
  if (!validDate(date)) return c.json(json400('Invalid date.'), 400);
  await db().delete(attendanceEntries)
    .where(and(eq(attendanceEntries.userId, c.get('user').id), eq(attendanceEntries.date, date)));
  return c.body(null, 204);
});

/** Clears one month (YYYY-MM) of manual entries. */
dataRoutes.delete('/entries', async c => {
  const month = c.req.query('month') ?? '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return c.json(json400('Provide ?month=YYYY-MM.'), 400);
  const [year, mon] = month.split('-').map(Number);
  const next = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, '0')}`;
  await db().delete(attendanceEntries).where(and(
    eq(attendanceEntries.userId, c.get('user').id),
    gte(attendanceEntries.date, `${month}-01`),
    lt(attendanceEntries.date, `${next}-01`),
  ));
  return c.body(null, 204);
});

/**
 * Imports settings and entries. `replace` (backup restore) deletes existing entries first;
 * `merge` (first sign-in) keeps existing account entries and fills in the rest.
 */
dataRoutes.post('/import', bodyLimit({ maxSize: 2 * 1024 * 1024, onError: c => c.json(json400('Import is too large.'), 413) }), async c => {
  const body = await readJson(c.req.raw) as { mode?: unknown; settings?: unknown; entries?: unknown } | undefined;
  const mode = body?.mode;
  if (mode !== 'replace' && mode !== 'merge') return c.json(json400('mode must be "replace" or "merge".'), 400);
  if (body?.settings !== null && !validSettings(body?.settings)) return c.json(json400('Invalid settings.'), 400);
  if (!validEntries(body?.entries)) return c.json(json400('Invalid entries.'), 400);
  const entries = Object.entries(body.entries);
  if (entries.length > MAX_IMPORT_ENTRIES) return c.json(json400('Too many entries.'), 413);
  const settings = body.settings as Settings | null;
  const userId = c.get('user').id;

  await db().transaction(async tx => {
    if (mode === 'replace') await tx.delete(attendanceEntries).where(eq(attendanceEntries.userId, userId));
    if (settings) {
      const values = settingsValues(userId, settings);
      const insert = tx.insert(userSettings).values(values);
      await (mode === 'replace' ? insert.onConflictDoUpdate({ target: userSettings.userId, set: values }) : insert.onConflictDoNothing());
    }
    // Insert in chunks to stay well under Postgres' parameter limit.
    for (let i = 0; i < entries.length; i += 1000) {
      const chunk = entries.slice(i, i + 1000).map(([date, status]) => ({ userId, date, status }));
      await tx.insert(attendanceEntries).values(chunk).onConflictDoNothing();
    }
  });
  return c.body(null, 204);
});

/** Deletes the user's InOffice data (settings and entries). The account itself remains. */
dataRoutes.delete('/data', async c => {
  const userId = c.get('user').id;
  await db().transaction(async tx => {
    await tx.delete(attendanceEntries).where(eq(attendanceEntries.userId, userId));
    await tx.delete(userSettings).where(eq(userSettings.userId, userId));
  });
  return c.body(null, 204);
});
