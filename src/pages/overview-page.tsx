import { useNavigate } from 'react-router';
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import { Button } from '@/components/ui/button.tsx';
import { calculateMonth, officeSplit, unloggedDays } from '@/lib/attendance.ts';
import { track } from '@/lib/analytics.ts';
import { useAttendance } from '@/state/attendance.tsx';

const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long' });
const shortMonth = new Intl.DateTimeFormat('en-GB', { month: 'short' });

type Month = {
  month: number;
  date: Date;
  c: ReturnType<typeof calculateMonth>;
  timing: 'past' | 'current' | 'future';
  logged: boolean;
  /** Office days on or before today, and office days after today (a plan). */
  done: number;
  planned: number;
  /** Past weekdays with nothing logged: gaps, so the month isn't judged on them. */
  gaps: number;
};

/** Plain, neutral words for how a month went: this is a private record, not a report card. */
function outcome({ c, timing, logged, done, gaps }: Month): { text: string; tone: string } {
  if (!c.effective) return { text: 'No target', tone: 'text-muted-foreground' };
  if (timing === 'past' && !logged) return { text: 'Nothing logged', tone: 'text-muted-foreground' };
  if (done >= c.required) return { text: 'Target met', tone: 'font-medium text-office-fg' };
  if (c.achieved) return { text: 'On plan', tone: 'font-medium text-foreground' };
  if (gaps && timing === 'past') return { text: `${gaps} not logged`, tone: 'text-muted-foreground' };
  if (timing === 'past') return { text: `${c.remaining} short`, tone: 'text-muted-foreground' };
  if (timing === 'future' && c.office === 0) return { text: `${c.required} needed`, tone: 'text-muted-foreground' };
  return { text: `${c.remaining} to plan`, tone: timing === 'current' ? 'font-medium text-accent-foreground' : 'text-muted-foreground' };
}

function MonthRow({ m, onOpen, grouped = false }: { m: Month; onOpen: (date: Date) => void; grouped?: boolean }) {
  const { c, timing } = m;
  const { text, tone } = outcome(m);
  const quiet = timing === 'future' || (timing === 'past' && !m.logged);
  return (
    <button
      type="button"
      data-overview-month={m.month}
      aria-current={timing === 'current' ? 'date' : undefined}
      aria-label={`${monthName.format(m.date)}: ${m.done} done${m.planned ? `, ${m.planned} planned` : ''} of ${c.required} office days${grouped ? '' : `, ${text}`}`}
      onClick={() => onOpen(m.date)}
      className={cn(
        'grid w-full grid-cols-[5rem_minmax(0,1fr)_4.5rem_5.25rem] items-center gap-3 px-4 py-3.5 text-left text-sm transition-colors duration-150 hover:bg-muted/60 sm:grid-cols-[8rem_minmax(0,1fr)_5.5rem_7rem] sm:px-5',
        timing === 'current' && 'bg-accent/60 hover:bg-accent',
      )}
    >
      <span className={cn('font-medium', quiet && 'text-muted-foreground')}>{monthName.format(m.date)}</span>
      <span className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {c.required > 0 && <>
          <span className="h-full bg-office" style={{ width: `${Math.min(100, (m.done / c.required) * 100)}%` }} />
          <span className="h-full bg-office/35" style={{ width: `${Math.max(0, Math.min(100, ((m.done + m.planned) / c.required) * 100) - Math.min(100, (m.done / c.required) * 100))}%` }} />
        </>}
      </span>
      <span className={cn('flex flex-col text-right tabular-nums leading-tight', quiet && 'text-muted-foreground')}>
        {m.done}/{c.required}
        {m.planned > 0 && <span className="whitespace-nowrap text-[11px] text-muted-foreground">+{m.planned} planned</span>}
      </span>
      <span className={cn('text-right text-xs', tone)}>{grouped ? '' : text}</span>
    </button>
  );
}

export function OverviewPage() {
  const state = useAttendance();
  const navigate = useNavigate();
  const year = state.viewDate.getFullYear();
  const now = new Date();

  const months: Month[] = Array.from({ length: 12 }, (_, month) => {
    const date = new Date(year, month, 1);
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    return {
      month,
      date,
      c: calculateMonth(date, state),
      timing: new Date(year, month + 1, 1) <= now ? 'past' : date > now ? 'future' : 'current',
      logged: Object.keys(state.entries).some(d => d.startsWith(prefix)),
      ...officeSplit(date, state, now),
      gaps: unloggedDays(date, state, now).length,
    };
  });

  // Year so far: only finished months with something logged are judged; the rest is days done and planned.
  // A month counts once it's over and either fully logged or already met (gaps can't undo a met target).
  const finished = months.filter(m => m.timing === 'past' && m.logged && m.c.effective && (!m.gaps || m.done >= m.c.required));
  const met = finished.filter(m => m.done >= m.c.required).length;
  const officeDays = months.reduce((n, m) => n + m.done, 0);
  const plannedDays = months.reduce((n, m) => n + m.planned, 0);
  const days = (n: number) => `${n} office day${n === 1 ? '' : 's'}`;
  const tally = `${days(officeDays)} so far${plannedDays ? ` and ${plannedDays} planned` : ''}`;
  const lead = !officeDays && !plannedDays ? `Nothing logged or planned in ${year} yet.`
    : finished.length ? `Target met in ${met} of ${finished.length} finished month${finished.length === 1 ? '' : 's'}, with ${tally}.`
    : `${tally[0]!.toUpperCase()}${tally.slice(1)} this year.`;

  // Runs of past months with nothing logged collapse into one row instead of a stack of empty cards.
  const groups: (Month | Month[])[] = [];
  for (const m of months) {
    const empty = m.timing === 'past' && !m.logged;
    const last = groups.at(-1);
    if (empty && Array.isArray(last)) last.push(m);
    else groups.push(empty ? [m] : m);
  }

  const open = (date: Date) => { state.setViewDate(date); navigate('/'); track('month_changed'); };
  const changeYear = (offset: number) => state.setViewDate(new Date(year + offset, state.viewDate.getMonth(), 1));

  return (
    <div id="overviewPage" aria-labelledby="overviewTitlePage" className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-end justify-between gap-4 px-1">
        <div>
          <h1 id="overviewTitlePage" className="text-2xl font-semibold tracking-tight">{year} overview</h1>
          <p className="text-sm text-muted-foreground">{lead}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="outline" size="icon" aria-label={`${year - 1} overview`} onClick={() => changeYear(-1)}><ChevronLeftIcon /></Button>
          <Button variant="outline" size="icon" aria-label={`${year + 1} overview`} onClick={() => changeYear(1)}><ChevronRightIcon /></Button>
        </div>
      </div>
      <div id="overviewGridPage" className="divide-y overflow-hidden rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.07]">
        {groups.map(g => Array.isArray(g)
          ? g.length === 1
            ? <MonthRow key={g[0]!.month} m={g[0]!} onOpen={open} />
            : (
              <details key={`empty-${g[0]!.month}`} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 sm:px-5 [&::-webkit-details-marker]:hidden">
                  <span className="font-medium">{shortMonth.format(g[0]!.date)} – {shortMonth.format(g.at(-1)!.date)}</span>
                  <span className="text-xs">Nothing logged</span>
                  <ChevronDownIcon className="ml-auto size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="divide-y border-t">
                  {g.map(m => <MonthRow key={m.month} m={m} onOpen={open} grouped />)}
                </div>
              </details>
            )
          : <MonthRow key={g.month} m={g} onOpen={open} />)}
      </div>
      <p className="px-1 text-xs text-muted-foreground">Select a month to open it in the calendar and plan or log its days.</p>
    </div>
  );
}
