import { useState } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { toast } from '@/components/ui/toast.tsx';
import { calculateMonth, getMonthDates, getStatus, isSameDay, isWeekday, iso, monthKey, officeSplit } from '@/lib/attendance.ts';
import { track } from '@/lib/analytics.ts';
import { useStartingCatchUp } from '@/components/catch-up.tsx';
import { useAttendance } from '@/state/attendance.tsx';

// The weekdays someone usually goes in (1 = Monday … 5 = Friday), remembered per device as a starting point.
const PATTERN_KEY = 'inoffice.usualdays.v1';
const SKIP_KEY = 'inoffice.planskip.v1';
const WEEKDAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri']] as const;
const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long' });

function read<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* A convenience only. */ }
}

/**
 * Planning happens a week at a time, not a day at a time: pick the usual office days once and fill the
 * rest of the month's open weekdays with planned office days, skipping leave, holidays and anything set.
 */
export function PlanUsualDays() {
  const state = useAttendance();
  const [pattern, setPattern] = useState<number[]>(() => read(PATTERN_KEY, []));
  const [skipped, setSkipped] = useState<string[]>(() => read(SKIP_KEY, []));
  const now = new Date();
  const month = monthKey(state.viewDate);
  const catchingUp = useStartingCatchUp(month);
  if (month < monthKey(now) || skipped.includes(month) || catchingUp) return null;

  // Only weekdays after today can be planned; offer this while nothing ahead is planned yet.
  const ahead = getMonthDates(state.viewDate).filter(d => d > now && !isSameDay(d, now) && isWeekday(d));
  if (ahead.some(d => Object.hasOwn(state.entries, iso(d)))) return null;
  const open = ahead.filter(d => getStatus(d, state) === 'blank');
  if (open.length < 3) return null;

  const targets = open.filter(d => pattern.includes(d.getDay()));
  const name = monthName.format(state.viewDate);
  const toggle = (day: number) => setPattern(p => (p.includes(day) ? p.filter(d => d !== day) : [...p, day].sort()));
  const skip = () => { const next = [...skipped, month]; write(SKIP_KEY, next); setSkipped(next); };

  const plan = () => {
    const keys = targets.map(iso);
    if (!keys.every(k => state.setEntry(k, 'office'))) return;
    write(PATTERN_KEY, pattern);
    track('attendance_status_changed');
    const entries = { ...state.entries, ...Object.fromEntries(keys.map(k => [k, 'office' as const])) };
    const after = { ...state, entries };
    const c = calculateMonth(state.viewDate, after);
    const { done } = officeSplit(state.viewDate, after);
    const effect = !c.effective ? '' : done >= c.required ? ' · target met' : c.achieved ? ' · on plan' : ` · ${c.remaining} more to plan`;
    const id = `plan-${month}`;
    toast.add({
      id,
      title: `Planned ${keys.length} office day${keys.length === 1 ? '' : 's'} in ${name}${effect}`,
      timeout: 6000,
      actionProps: { children: 'Undo', onClick: () => { toast.close(id); keys.forEach(k => state.setEntry(k, null)); } },
    });
  };

  return (
    <section aria-labelledby="planUsualTitle" className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-xs ring-1 ring-foreground/[0.07]">
      <div className="flex flex-col gap-1">
        <h2 id="planUsualTitle" className="text-base font-semibold tracking-tight">Plan your usual days</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Pick the days you normally go in and the rest of {name} is planned for you. Leave and bank holidays are skipped.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Usual office days">
        {WEEKDAYS.map(([day, label]) => (
          <Button
            key={day}
            variant="outline"
            size="sm"
            aria-pressed={pattern.includes(day)}
            onClick={() => toggle(day)}
            className="min-w-12 aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground"
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={!targets.length} onClick={plan}>
          {targets.length ? `Plan ${targets.length} office day${targets.length === 1 ? '' : 's'}` : 'Pick your days'}
        </Button>
        <Button variant="ghost" onClick={skip}>Not this month</Button>
      </div>
    </section>
  );
}
