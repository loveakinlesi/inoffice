import { useSyncExternalStore } from 'react';
import { CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import { Button } from '@/components/ui/button.tsx';
import { getAutoHoliday, isSameDay, isWeekday, iso, monthKey, unloggedDays } from '@/lib/attendance.ts';
import { track } from '@/lib/analytics.ts';
import { useAttendance } from '@/state/attendance.tsx';
import type { Status } from '@/lib/types.ts';

// Months the user finished or skipped catching up on, per device. The v1 key held a single month.
const KEY = 'inoffice.catchup.v1';
const LEGACY_KEY = 'inoffice.firststeps.v1';
const chipLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric' });
const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long' });

function readSkipped(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    const legacy = localStorage.getItem(LEGACY_KEY);
    return [...(Array.isArray(list) ? list.filter((m): m is string => typeof m === 'string') : []), ...(legacy ? [legacy] : [])];
  } catch { return []; }
}

/** The gap days a month had when its card first appeared, so chips stay put while they're filled in. */
const snapshots = new Map<string, { days: string[]; starting: boolean }>();

// Shared so the planning card can wait until a brand-new month has been caught up on.
let skippedMonths = readSkipped();
const listeners = new Set<() => void>();
function skipMonth(month: string) {
  skippedMonths = [...new Set([...skippedMonths, month])];
  try { localStorage.setItem(KEY, JSON.stringify(skippedMonths)); } catch { /* Hides for this visit regardless. */ }
  listeners.forEach(l => l());
}
function useSkipped() {
  return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => skippedMonths);
}
/** True while a month's first "get started" card is still open, so other prompts don't pile up under it. */
export function useStartingCatchUp(month: string) {
  const skipped = useSkipped();
  return Boolean(snapshots.get(month)?.starting) && !skipped.includes(month);
}

/**
 * Offered when the viewed month has past weekdays with nothing logged (or the current month is still
 * empty): those are gaps in the record, so the user can fill them in before the month is judged on them.
 */
export function CatchUp({ placement }: { placement: 'top' | 'below' }) {
  const state = useAttendance();
  const skipped = useSkipped();
  const now = new Date();
  const month = monthKey(state.viewDate);
  const current = month === monthKey(now);
  const gaps = unloggedDays(state.viewDate, state, now);
  const monthEmpty = !Object.keys(state.entries).some(d => d.startsWith(`${month}-`));

  if (skipped.includes(month) || state.viewDate > now) return null;
  if (!snapshots.has(month)) {
    if (!gaps.length && !(current && monthEmpty)) return null;
    snapshots.set(month, { days: gaps.map(iso), starting: current && monthEmpty });
  }
  const snapshot = snapshots.get(month)!;
  const days = snapshot.days.map(k => { const [y, m, d] = k.split('-').map(Number); return new Date(y!, m! - 1, d); });

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayOpen = current && isWeekday(today) && !getAutoHoliday(today, state);
  const statusOf = (d: Date) => state.entries[iso(d)] as Status | undefined;
  const set = (d: Date, status: Status | null) => { if (state.setEntry(iso(d), status)) track('attendance_status_changed'); };
  const finish = (reason: 'done' | 'skipped') => {
    track(reason === 'done' ? 'first_steps_done' : 'first_steps_skipped');
    skipMonth(month);
  };
  const todayStatus = statusOf(today);
  const added = days.filter(d => statusOf(d) === 'office').length;
  const open = days.filter(d => statusOf(d) === undefined);
  const name = monthName.format(state.viewDate);
  const starting = snapshot.starting;
  // A brand-new month leads with this card; gaps in a month already under way sit below the summary.
  if ((placement === 'top') !== starting) return null;

  return (
    <section aria-labelledby="catchUpTitle" className="flex flex-col gap-5 rounded-2xl bg-card p-5 shadow-xs ring-1 ring-primary/30">
      <div className="flex flex-col gap-1">
        <h2 id="catchUpTitle" className="text-lg font-semibold tracking-tight">
          {starting ? 'Let’s get this month started' : `Fill in the gaps in ${name}`}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {starting
            ? 'Your target counts every working day this month. Log the days you’ve already been in, then plan the rest.'
            : `Days with nothing logged aren’t counted against you, but ${name} can’t show how it really went until they’re filled in.`}
        </p>
      </div>

      {todayOpen && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Where are you today?</p>
          <div className="flex flex-wrap gap-2">
            {(['office', 'home'] as const).map(s => (
              <Button
                key={s}
                variant="outline"
                aria-pressed={todayStatus === s}
                onClick={() => set(today, todayStatus === s ? null : s)}
                className="aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground"
              >
                <span aria-hidden="true">{s === 'office' ? '🏢' : '🏠'}</span>
                {s === 'office' ? 'In the office' : 'Working from home'}
              </Button>
            ))}
          </div>
        </div>
      )}

      {days.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Which of these days were you in the office?</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Weekdays with nothing logged in ${name}`}>
            {days.filter(d => !isSameDay(d, today)).map(d => {
              const status = statusOf(d);
              const office = status === 'office';
              return (
                <button
                  key={iso(d)}
                  type="button"
                  aria-pressed={office}
                  aria-label={`${chipLabel.format(d)}${status && !office ? `, ${status}` : ''}`}
                  onClick={() => set(d, office ? null : 'office')}
                  className={cn(
                    'inline-flex h-9 items-center gap-1 rounded-full border px-3 text-sm tabular-nums transition-colors duration-150',
                    office ? 'border-office-line bg-office-soft text-office-fg'
                      : status ? 'border-dashed bg-card text-muted-foreground hover:border-ring'
                      : 'bg-card hover:border-ring',
                  )}
                >
                  {office && <CheckIcon className="size-3.5" aria-hidden="true" />}
                  {status && !office && <span aria-hidden="true">{status === 'home' ? '🏠' : '·'}</span>}
                  {chipLabel.format(d)}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {added ? `${added} office day${added === 1 ? '' : 's'} added.` : 'Tap each day you went in.'}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => finish('done')}>Done</Button>
        {open.length > 0 && !starting && (
          <Button variant="outline" onClick={() => open.forEach(d => set(d, 'home'))}>The rest were home days</Button>
        )}
        <Button variant="ghost" onClick={() => finish('skipped')}>Skip this month</Button>
      </div>
    </section>
  );
}
