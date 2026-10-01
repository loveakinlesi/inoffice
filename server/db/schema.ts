import { relations, sql } from 'drizzle-orm';
import { boolean, date, index, pgSchema, primaryKey, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// All InOffice tables live in their own Postgres schema. The Supabase database is shared with
// another project, and Supabase's Data API only exposes `public`, so nothing here is reachable
// with the anon key: every read and write goes through the authenticated InOffice API.
export const inoffice = pgSchema('inoffice');

export const attendanceMode = inoffice.enum('attendance_mode', ['percentage', 'days']);
export const region = inoffice.enum('region', ['england-and-wales', 'scotland', 'northern-ireland']);
export const status = inoffice.enum('status', ['home', 'office', 'ooo', 'sick', 'bank']);

// --- Better Auth tables (generated with `pnpm dlx auth generate`; keep in sync after upgrades) ---

export const user = inoffice.table("user", {
  id: uuid("id")
    .default(sql`pg_catalog.gen_random_uuid()`)
    .primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = inoffice.table(
  "session",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = inoffice.table(
  "account",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = inoffice.table(
  "verification",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// --- InOffice data ---

const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date());

/** One row per user, mirroring the client's Settings shape. */
export const userSettings = inoffice.table('user_settings', {
  userId: uuid('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  attendanceMode: attendanceMode('attendance_mode').notNull().default('percentage'),
  targetPercentage: real('target_percentage').notNull().default(50),
  targetDaysPerWeek: real('target_days_per_week'),
  region: region('region').notNull().default('england-and-wales'),
  onboardingComplete: boolean('onboarding_complete').notNull().default(false),
  updatedAt: updatedAt(),
});

/** One row per recorded day; absent rows are blank days. */
export const attendanceEntries = inoffice.table('attendance_entries', {
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  date: date('date', { mode: 'string' }).notNull(),
  status: status('status').notNull(),
  updatedAt: updatedAt(),
}, t => [primaryKey({ columns: [t.userId, t.date] })]);
