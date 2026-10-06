# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

UK hybrid employees whose employer sets an office-attendance target (a percentage of working days, or a number of days per week). They use InOffice on desktop and phone equally: planning which days they'll go in, logging what actually happened in a tap, and checking whether the month's plan meets the target. It is an installable web app (PWA), so phone use often happens from the home screen.

## Product Purpose

InOffice is both a planner and a tracker. Users plan their office days ahead (marking future weekdays as Office, Home or OOO), then log what actually happened, and it tells them at a glance whether their plan and their record meet the office target and how many more office days they need. Success is the user never having to work the number out themselves, being able to plan a month that works before it starts, and never being surprised at month end.

## Positioning

- **Private and personal.** It is the worker's own record, never visible to an employer. It works fully as a guest with data kept only in the browser; a Google account is optional and only adds sync across devices.
- **Plan ahead, then track.** Future days are a plan, past days are a record, on the same calendar. The user can see whether the month's plan already gets them to target before the month happens.
- **Answers "how many more days?"** It computes required and remaining office days for the user, net of UK bank holidays, out-of-office and sick days, rather than leaving them to count.
- **Effortless daily logging.** One tap per day cycles a day's status; there is nothing to maintain.

## Operating Context

- Planning: at the start of a week or month, mark future weekdays as Office (or Home / OOO for booked leave) to see whether the plan meets the target and how many more office days to fit in.
- Daily: open the app, tap today (or any weekday) to cycle Blank → Office → Home → OOO → Sick, or right-click / press and hold to pick a status directly.
- Periodically: read the monthly summary (office / required, %, remaining), browse months, open the year overview to compare all twelve months.
- Occasionally: change the target, re-run setup, export/restore a JSON backup, clear a month, delete data or the account.
- First run: landing page offers Google sign-in or guest; setup asks a guest's first name, then the target.

## Capabilities and Constraints

- Monday–Friday working week; weekends are not selectable.
- Statuses: Office, Home, OOO, Sick, plus automatic Bank holiday. Terminology: "office days", "working days" (weekdays minus bank holidays and OOO), "required", "remaining", "target".
- Target modes: percentage of working days, or days per week.
- UK bank holidays from GOV.UK for England & Wales, Scotland, Northern Ireland, cached with fallback.
- Guest data lives in localStorage; signed-in data lives in Postgres via the app's API (Better Auth, Google only). Guest data can be imported into an account on first sign-in.
- Light, dark and system themes.
- Stack: React + Vite + Tailwind v4 + shadcn (Base UI), Hono API, deployed on Vercel.

## Brand Commitments

- Name: InOffice.
- Status emoji are part of the product's personality and stay: 🏢 Office, 🏠 Home, 🌴 OOO, 🤒 Sick, 🎉 Bank holiday.
- Voice: friendly and plain-spoken (e.g. "Hi Love", "3 more office days to go"); no corporate or HR tone.
- The current logo (`public/logo.png`) is not a binding commitment.

## Evidence on Hand

- No testimonials, user counts, press or employer endorsements exist; do not fabricate any.
- Real assets: `public/logo.png`, app icons in `public/`.

## Product Principles

1. The number comes first: "how many more office days" should never take more than a glance.
2. Plan and record are distinct: future office days are plans, past ones are done; the UI should never present a plan as an achievement, and should make planning ahead as easy as logging.
3. Logging and planning must stay one tap; anything that adds friction to the daily action needs a strong reason.
4. Private by default: never imply the employer can see the data, and keep guest mode first-class.
5. Equal footing for phone and desktop: neither layout is an afterthought.

## Accessibility & Inclusion

Existing commitments to keep: keyboard-accessible dialogs, visible focus states, screen-reader labels on calendar days, reduced-motion support, and status never conveyed by color alone (emoji and labels accompany it).
