import { boolean, date, pgSchema, primaryKey, real, text, timestamp } from 'drizzle-orm/pg-core';

// All InOffice tables live in their own Postgres schema. The Supabase database is shared with
// another project, and Supabase's Data API only exposes `public`, so nothing here is reachable
// with the anon key: every read and write goes through the authenticated InOffice API.
export const inoffice = pgSchema('inoffice');

export const attendanceMode = inoffice.enum('attendance_mode', ['percentage', 'days']);
export const region = inoffice.enum('region', ['england-and-wales', 'scotland', 'northern-ireland']);
export const status = inoffice.enum('status', ['home', 'office', 'ooo', 'sick', 'bank']);

const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date());

/** One row per user, mirroring the client's Settings shape. */
export const userSettings = inoffice.table('user_settings', {
  userId: text('user_id').primaryKey(),
  attendanceMode: attendanceMode('attendance_mode').notNull().default('percentage'),
  targetPercentage: real('target_percentage').notNull().default(50),
  targetDaysPerWeek: real('target_days_per_week'),
  region: region('region').notNull().default('england-and-wales'),
  onboardingComplete: boolean('onboarding_complete').notNull().default(false),
  updatedAt: updatedAt(),
});

/** One row per recorded day; absent rows are blank days. */
export const attendanceEntries = inoffice.table('attendance_entries', {
  userId: text('user_id').notNull(),
  date: date('date', { mode: 'string' }).notNull(),
  status: status('status').notNull(),
  updatedAt: updatedAt(),
}, t => [primaryKey({ columns: [t.userId, t.date] })]);
