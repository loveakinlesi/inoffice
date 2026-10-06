import { cn } from '@/lib/utils.ts';
import { CircleCheckIcon } from 'lucide-react';
import { calculateMonth, getMonthDates, getStatus, isWeekday, officeSplit, unloggedDays } from '@/lib/attendance.ts';
import { useAttendance } from '@/state/attendance.tsx';

const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long' });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One segment per required office day: solid for days done, lighter for days planned ahead. */
function DayMeter({ done, planned, required }: { done: number; planned: number; required: number }) {
  if (!required) return null;
  const label = `${done} done${planned ? ` and ${planned} planned` : ''} of ${required} required office days`;
  return (
    <div role="progressbar" aria-label="Office days progress" aria-valuemin={0} aria-valuemax={required} aria-valuenow={Math.min(done, required)} aria-valuetext={label} className="flex h-2.5 gap-1">
      {Array.from({ length: required }, (_, i) => (
        <span key={i} className={cn('min-w-0 flex-1 rounded-full transition-colors duration-300', i < done ? 'bg-office' : i < done + planned ? 'bg-office/35' : 'bg-muted')} />
      ))}
    </div>
  );
}

function Fact({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tracking-tight tabular-nums">{value}</dd>
      <dd className="text-xs leading-4 text-muted-foreground">{note}</dd>
    </div>
  );
}

export function MonthSummary() {
  const state = useAttendance();
  const { settings, viewDate, firstName } = state;
  const c = calculateMonth(viewDate, state);
  const month = monthName.format(viewDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const monthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
  const timing = monthEnd <= today ? 'past' : monthStart > today ? 'future' : 'current';
  const target = settings.attendanceMode === 'days' ? `${settings.targetDaysPerWeek} days a week` : `${settings.targetPercentage}%`;
  // Past office days are done; office days after today are a plan. Unlogged past weekdays are gaps, not absences.
  const { done, planned } = officeSplit(viewDate, state, now);
  const gaps = unloggedDays(viewDate, state, now).length;
  const days = getMonthDates(viewDate).filter(isWeekday);
  // Weekdays still open for planning, and planned home days that could be swapped for the office.
  const open = days.filter(d => d >= today && getStatus(d, state) === 'blank').length;
  const swappable = days.filter(d => d >= today && getStatus(d, state) === 'home').length;
  const met = c.effective > 0 && done >= c.required;
  const onPlan = c.effective > 0 && !met && c.achieved;
  const progress = done || planned ? `${done} done${planned ? `, ${planned} planned` : ''}. ` : '';
  const gapNote = gaps ? ` ${plural(gaps, 'earlier weekday')} ${gaps === 1 ? 'isn’t' : 'aren’t'} logged yet.` : '';

  const headline = !c.effective ? 'No office target this month'
    : met ? 'Target met'
    : onPlan ? 'You’re on plan'
    : timing === 'past' && gaps ? `${plural(gaps, 'weekday')} not logged`
    : timing === 'past' ? `Finished ${c.remaining} short`
    : `${plural(c.remaining, 'more office day')} to ${timing === 'future' || planned ? 'plan' : 'go'}`;

  const pace = !c.effective ? `Every working day in ${month} is a bank holiday or leave, so there’s nothing to aim for.`
    : met ? (timing === 'past' ? `You made ${c.office} of ${c.required} office days in ${month}. Nicely done.` : `${done} of ${c.required} office days done. Anything more this month is a bonus.`)
    : onPlan ? `${progress}Stick to the plan and you’ll hit ${c.required}.${gapNote}`
    : timing === 'past' && gaps ? `${plural(done, 'office day')} logged in ${month}. Fill in the gaps to see how it really went.`
    : timing === 'past' ? `${c.office} of ${c.required} office days in ${month}. A fresh month is a fresh start.`
    : timing === 'future' && !planned ? `${c.required} office days needed in ${month}. Plan them on the calendar.`
    : timing === 'future' ? `${planned} of ${c.required} office days planned for ${month}.`
    : c.remaining <= open ? `${progress}${plural(open, 'unplanned weekday')} left to fit the rest in.${gapNote}`
    : c.remaining <= open + swappable ? `${progress}Only ${plural(open, 'unplanned weekday')} left, so swap ${c.remaining - open} planned home day${c.remaining - open === 1 ? '' : 's'} for the office to make it.${gapNote}`
    : `${progress}Even going in every remaining day, this month will land ${c.remaining - open - swappable} short.${gapNote}`;

  return (
    <section aria-labelledby="summaryTitle" className="flex min-w-0 flex-col gap-3">
      <h2 id="summaryTitle" className="px-1 text-xl font-semibold tracking-tight">
        {firstName ? `Hi ${firstName}` : 'Monthly summary'}
      </h2>
      <div id="statsGrid" className="flex flex-col gap-5 rounded-2xl bg-card p-5 shadow-xs ring-1 ring-foreground/[0.07]">
        <div className="flex flex-col gap-2">
          <p
            id="statusMessage"
            key={headline}
            className={cn('text-2xl font-semibold tracking-tight text-balance sm:text-3xl', met && 'animate-in fade-in zoom-in-95 text-office-fg duration-300')}
          >
            {met && <CircleCheckIcon className="mr-2 inline size-7 -translate-y-0.5 align-middle" aria-hidden="true" />}
            {headline}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">{pace}</p>
        </div>
        <DayMeter done={done} planned={planned} required={c.required} />
        {c.effective > 0 && (
          <p className="-mt-2 text-xs leading-5 text-muted-foreground">
            {c.required} needed: {target} of {plural(c.effective, 'working day')}, rounded up.{planned > 0 && ' Lighter segments are planned days.'}
          </p>
        )}
        <dl className="grid grid-cols-3 gap-x-4 border-t pt-4">
          <Fact label="Working days" value={c.effective} note="After leave" />
          <Fact label="Leave" value={c.ooo + c.sick} note="OOO and sick" />
          <Fact label="Bank holidays" value={c.bank} note="Not counted" />
        </dl>
      </div>
    </section>
  );
}
