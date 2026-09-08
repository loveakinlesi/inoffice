# InOffice

**Stay on top of your hybrid office attendance.**

InOffice is a lightweight attendance tracker for hybrid workers. Set your office target, record your days, and see what you need to meet your monthly goal. Your attendance stays in your browser—no account, database, or backend required.

## Features

- **Simple setup:** choose a percentage of working days or office days per week.
- **Monthly summary:** office, required, and remaining days appear above the calendar.
- **Interactive calendar:** Monday-first, with disabled weekends and a highlighted current day.
- **UK bank holidays:** England & Wales, Scotland, and Northern Ireland, with cached fallback and manual overrides.
- **Progress tracking:** see your progress against the monthly office target.
- **Year overview:** compare all twelve months and jump directly to a month.
- **Backup and restore:** export or import settings, attendance, and cached holidays as JSON.
- **Responsive and accessible:** compact mobile cards, keyboard-accessible dialogs, visible focus states, and reduced-motion support.

## Getting started

Use Node.js 22.12+ and pnpm 11.20.0. The pnpm version is pinned in `package.json`.

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
| `pnpm test:e2e` | Run Playwright browser tests |

Install the browser before running end-to-end tests:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

Browser tests cover onboarding, both target modes, calendar interactions, persistence, settings, backup import/export, resets, holiday fallback, and responsive layouts. One test calls the live GOV.UK service and requires internet access. To use an existing Chromium installation, set `PLAYWRIGHT_EXECUTABLE_PATH` to its executable.

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

Forecasting is intentionally hidden for now. The existing forecast module remains in `src/forecast.js` so it can be reintroduced later when the experience is ready.

### Bank holidays

Holiday data comes from the [GOV.UK bank holiday API](https://www.gov.uk/bank-holidays.json). Responses are cached for seven days. Failed refreshes use cached data where available; holidays can also be marked manually.

The API covers a limited set of years. InOffice shows a notice when the selected year has no automatic holiday data.

## Privacy and storage

Attendance records, preferences, setup completion, and the holiday cache are stored in **LocalStorage**, using these keys:

```text
inoffice.settings.v1
inoffice.entries.v1
inoffice.holidays.v1
```

There is no authentication, cloud sync, or server-side attendance storage. Data belongs to the current browser and site origin. Clearing browser data or switching devices does not transfer your records; use JSON export/import to keep a backup or move them.

Imports are validated before confirmation and replacement. Exported backups contain attendance history, so avoid committing them to a public repository. Reset actions require confirmation; rerunning setup preserves attendance history.

The app also makes these network requests:

- **GOV.UK:** downloads the UK holiday calendars.
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

No environment variables or application server are required. SPA rewrites preserve the assets and analytics routes.

To collect analytics, [enable Web Analytics in the Vercel project](https://vercel.com/docs/analytics/quickstart) and deploy. Custom-event availability depends on your Vercel plan. Analytics integration lives in `src/analytics.js` and is disabled during development.

## Project structure

```text
public/                 Favicon and app icon
src/
  main.js               App startup and event wiring
  state.js              Initial application state
  storage.js            LocalStorage access and migration
  validation.js         Stored data and backup validation
  attendance.js         Pure monthly attendance calculations
  forecast.js           Future remaining-day forecasts
  holidays.js           GOV.UK fetching and cache handling
  calendar.js           Monthly calendar rendering
  dashboard.js          Summary metrics and progress
  overview.js           Year overview
  onboarding.js         First-run setup
  settings.js           Preferences and data actions
  target-controls.js    Shared attendance target controls
  constants.js          Status and region definitions
  ui.js                 Dialog and notification helpers
  analytics.js          Optional privacy-safe telemetry
  styles.css            Tailwind and shared styles
tests/                  Unit and browser tests
```

Built with Vite, vanilla JavaScript, and Tailwind CSS. No frontend framework is used.

## Contributing

Issues and pull requests are welcome. For a substantial change, open an issue first to discuss the approach.

1. Fork the repository and create a branch for your change.
2. Install dependencies with `pnpm install --frozen-lockfile`.
3. Keep attendance data local and preserve the vanilla JavaScript architecture.
4. Run `pnpm test` and `pnpm build`; run browser tests when changing user flows.
5. Describe the change and relevant verification in your pull request.

Use synthetic attendance data in screenshots, fixtures, and issue reports.

## Licence

[MIT](LICENSE) © 2026 Love Akinlesi.
