# InOffice

**Stay on top of your hybrid office attendance.**

InOffice is a lightweight attendance tracker for hybrid workers. Set your office target, record your days, and see what you need to meet your monthly goal. Use it as a guest and your attendance stays in your browser, or sign in with Google to keep it in sync across devices.

## Features

- **Simple setup:** choose a percentage of working days or office days per week.
- **Monthly summary:** office, required, and remaining days appear above the calendar.
- **Interactive calendar:** Monday-first, with disabled weekends and a highlighted current day.
- **UK bank holidays:** England & Wales, Scotland, and Northern Ireland, with cached fallback and manual overrides.
- **Progress tracking:** see your progress against the monthly office target.
- **Year overview:** compare all twelve months and jump directly to a month.
- **Optional account:** sign in with Google to save attendance to your account and use it on any device. Guest data can be imported on first sign-in.
- **Backup and restore:** export or import settings, attendance, and cached holidays as JSON.
- **Responsive and accessible:** compact mobile cards, keyboard-accessible dialogs, visible focus states, and reduced-motion support.

## Getting started

Use Node.js 22.22+ and pnpm 11.20.0. The pnpm version is pinned in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite, then complete the two-step setup.

### Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local development server |
| `pnpm build` | Build the production app into `dist/` |
| `pnpm preview` | Preview the production build locally |
| `pnpm test` | Run calculation, validation, and storage tests |
| `pnpm typecheck` | Type-check the project with TypeScript |
| `pnpm db:generate` | Generate a SQL migration from `server/db/schema.ts` |
| `pnpm db:migrate` | Apply pending migrations to the database in `.env.local` |
| `pnpm test:e2e` | Run Playwright browser tests |

Install the browser before running end-to-end tests:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

Browser tests cover onboarding, both target modes, calendar interactions, persistence, settings, backup import/export, resets, holiday fallback, responsive layouts, and signed-in sync, offline behaviour and first-sign-in import. They start their own dev server on port 5174 with an in-memory PGlite database and a test-only sign-in route, so they need no credentials and never touch real data. API tests (`tests/api.test.ts`) also run against PGlite. One test calls the live GOV.UK service and requires internet access. To use an existing Chromium installation, set `PLAYWRIGHT_EXECUTABLE_PATH` to its executable.

### Database (accounts and sync)

Guest mode needs no backend. Account features use a Supabase Postgres database through the API in `server/`. To work on them locally:

1. Link the project and pull its environment variables (or copy `.env.example` to `.env.local` and fill it in):

   ```sh
   pnpm dlx vercel link
   pnpm dlx vercel env pull .env.local
   ```

2. Apply migrations:

   ```sh
   pnpm db:migrate
   ```

Sign-in uses [Better Auth](https://www.better-auth.com) with Google. Create an OAuth client in Google Cloud Console with the redirect URI `http://127.0.0.1:5173/api/auth/callback/google` (and `http://localhost:5173/...` if you use that host), then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. See `.env.example` for every variable.

`pnpm dev` serves the API from the Vite dev server; `GET /api/health` reports database connectivity. All InOffice tables, and the migration history, live in a dedicated `inoffice` Postgres schema. After changing `server/db/schema.ts`, run `pnpm db:generate` and commit the new file in `drizzle/`.

## How attendance is calculated

InOffice assumes a Monday–Friday working week.

```text
Working days = Weekdays − Bank holidays − OOO days
Required office days = ceil(Working days × Target percentage / 100)
Remaining days = max(Required office days − Office days, 0)
```

For example, with 22 weekdays, one bank holiday, one OOO day, and a 50% target, you need **10 office days**. If you have recorded six, you need four more.

A days-per-week target converts to a percentage of a five-day week: three office days per week becomes 60%. It is applied to the monthly calculation, rather than enforcing a separate weekly quota.

### Recording days

Select a weekday to cycle through:

**Home → Office → OOO → Bank holiday → Home**

Only weekdays count. Bank holidays and OOO days are excluded from working days. Manual entries take precedence over automatic bank holidays, including an explicit Home entry.

Future Office entries count toward the monthly total as planned attendance.

### Future additions

Forecasting is intentionally hidden for now. The existing forecast module remains in `src/lib/forecast.ts` so it can be reintroduced later when the experience is ready.

### Bank holidays

Holiday data comes from the [GOV.UK bank holiday API](https://www.gov.uk/bank-holidays.json). Responses are cached for seven days. Failed refreshes use cached data where available; holidays can also be marked manually.

The API covers a limited set of years. InOffice shows a notice when the selected year has no automatic holiday data.

## Privacy and storage

### As a guest

Attendance records, preferences, setup completion, and the holiday cache are stored in **LocalStorage**, using these keys:

```text
inoffice.settings.v1
inoffice.entries.v1
inoffice.holidays.v1
```

Guest data belongs to the current browser and site origin. Clearing browser data or switching devices does not transfer your records; use JSON export/import to keep a backup or move them.

### When signed in

Signing in uses Google through [Better Auth](https://www.better-auth.com). InOffice stores your Google name, email address and profile picture URL, a session, and your settings and attendance entries in Postgres. Holiday data stays in the browser.

- The account is the source of truth while you are signed in. Guest data in the browser is left untouched and is used again after you sign out.
- On first sign-in, InOffice offers to import this browser's guest data. Import merges: anything already in your account is kept. The local copy is not deleted.
- Changes are saved immediately. They are not queued offline: while offline, InOffice shows a notice and blocks changes until you reconnect.
- **Reset all InOffice data** deletes your settings and attendance from the account. Deleting the account removes its data too.

Every API route requires a valid session, scopes queries to that user, validates input with the same rules as the client, and rejects cross-site writes.

### Everywhere

Imports are validated before confirmation and replacement. Exported backups contain attendance history, so avoid committing them to a public repository. Reset actions require confirmation; rerunning setup preserves attendance history.

The app also makes these network requests:

- **GOV.UK:** downloads the UK holiday calendars.
- **Google:** only when you choose to sign in.
- **Vercel Web Analytics:** records production page views and allowlisted product interactions. Custom events contain no attendance dates, statuses, targets, regions, or backup contents. Page URLs are reduced to the site origin. Analytics failure does not prevent use of the app.

Legacy `office-attendance.*.v1` data is migrated automatically when present on the same origin. Data from a local `file://` page generally cannot be accessed from a hosted site.

## Deploy to Vercel

Import the repository into Vercel using the **Vite** preset. The included `vercel.json` configures:

| Setting | Value |
| --- | --- |
| Install command | `pnpm install --frozen-lockfile` |
| Build command | `pnpm run build` |
| Output directory | `dist` |

Alternatively, deploy from the project directory:

```sh
pnpm dlx vercel
```

`api/index.ts` runs the Hono API as a Vercel Function; `vercel.json` rewrites `/api/*` to it and everything else (except assets and analytics) to the SPA.

Without any environment variables, InOffice deploys as a guest-only app: `/api/config` reports no sign-in provider and the sign-in UI stays hidden. To enable accounts:

1. Add Supabase from the Vercel Marketplace (or set `POSTGRES_URL` and `POSTGRES_URL_NON_POOLING` for any Postgres).
2. Run `pnpm db:migrate` against that database.
3. Set `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), and `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from a Google OAuth client whose redirect URI is `https://<your-domain>/api/auth/callback/google`.
4. If you serve the app from a custom domain, add it to `AUTH_ALLOWED_HOSTS`.

To collect analytics, [enable Web Analytics in the Vercel project](https://vercel.com/docs/analytics/quickstart) and deploy. Custom-event availability depends on your Vercel plan. Analytics integration lives in `src/lib/analytics.ts` and is disabled during development.

## Project structure

```text
public/                   Icons, manifest and service worker
api/index.ts              Vercel Function entry for /api/*
server/
  app.ts                  Hono API routes
  auth.ts                 Better Auth configuration
  db/                     Drizzle schema, client and migration runner
drizzle/                  Generated SQL migrations
src/
  main.tsx                React entry point and service worker registration
  App.tsx                 Providers, onboarding gate and routes
  state/attendance.tsx    AttendanceProvider and useAttendance() state hook
  pages/                  Calendar, year overview and settings screens
  components/             App shell, calendar, summary, onboarding, install prompt
  components/ui/          shadcn/ui components
  lib/
    types.ts              Shared data types
    storage.ts            LocalStorage access and migration
    validation.ts         Stored data and backup validation
    attendance.ts         Pure monthly attendance calculations
    forecast.ts           Future remaining-day forecasts
    holidays.ts           GOV.UK fetching and cache handling
    constants.ts          Status and region definitions
    analytics.ts          Optional privacy-safe telemetry
  styles.css              Tailwind, shadcn theme and shared styles
tests/                    Unit, API (PGlite) and browser tests
```

Built with Vite, React, TypeScript, Tailwind CSS and [shadcn/ui](https://ui.shadcn.com) (Base UI primitives).

## Contributing

Issues and pull requests are welcome. For a substantial change, open an issue first to discuss the approach.

1. Fork the repository and create a branch for your change.
2. Install dependencies with `pnpm install --frozen-lockfile`.
3. Keep calculation logic in `src/lib/` free of React so it stays unit-testable.
4. Run `pnpm typecheck`, `pnpm test` and `pnpm build`; run browser tests when changing user flows.
5. Describe the change and relevant verification in your pull request.

Use synthetic attendance data in screenshots, fixtures, and issue reports.

## Licence

[MIT](LICENSE) © 2026 Love Akinlesi.
