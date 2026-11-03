import { TriangleAlertIcon } from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import { Button } from '@/components/ui/button.tsx';
import { calculateLeave, cycleFor, formatDays, plural, type LeaveBalance } from '@/lib/leave.ts';
import { useAttendance } from '@/state/attendance.tsx';

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const longDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const parse = (iso: string) => new Date(`${iso}T12:00:00`);

/** One segment per day of the cycle's allowance: solid for days taken, lighter for planned, red for days past the allowance. */
function LeaveMeter({ b }: { b: LeaveBalance }) {
  const total = Math.max(Math.ceil(b.allowance + b.carryover - b.carryoverLost), b.used);
  if (total <= 0 || total > 80) return null;
  const label = `${b.taken} taken, ${b.planned} planned of ${formatDays(b.allowance + b.carryover - b.carryoverLost)} available leave days`;
  return (
    <div role="img" aria-label={label} className="flex h-2.5 gap-0.5">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn('min-w-0 flex-1 rounded-full', i >= b.allowance + b.carryover - b.carryoverLost ? 'bg-destructive' : i < b.taken ? 'bg-ooo' : i < b.used ? 'bg-ooo/40' : 'bg-muted')} />
      ))}
    </div>
  );
}

/** Leave balance for the cycle containing the month being viewed. Hidden until leave tracking is on. */
export function LeaveCard() {
  const state = useAttendance();
  const { settings, viewDate, setViewDate } = state;
  const leave = settings.leave;
  if (!leave) return null;
  const cycle = cycleFor(viewDate, leave);
  const b = calculateLeave(cycle, leave, state);
  const over = b.overdrawn.length;
  const firstOver = b.overdrawn[0];
  const available = b.allowance + b.carryover - b.carryoverLost;

  const headline = over ? `${plural(over, 'day')} over your allowance` : `${formatDays(b.remaining)} leave day${b.remaining === 1 ? '' : 's'} left`;
  const detail = `${b.taken} taken${b.planned ? `, ${b.planned} planned` : ''} of ${formatDays(available)}${b.carryover ? ` (${formatDays(b.allowance)} + ${formatDays(b.carryover)} carried over)` : ''} for ${b.cycle.label}.`;
  const lostNote = b.carryoverExpires && b.carryoverLost > 0
    ? `${plural(b.carryoverLost, 'carried-over day')} ${b.carryoverExpired ? 'expired' : 'will expire'} on ${longDate.format(parse(b.carryoverExpires))}${b.carryoverExpired ? '' : ' unless you book them before then'}.`
    : b.carryoverExpires && !b.carryoverExpired && b.carryover > 0 ? `Carried-over days must be used by ${longDate.format(parse(b.carryoverExpires))}.` : null;

  return (
    <section aria-labelledby="leaveTitle" className="flex min-w-0 flex-col gap-3">
      <h2 id="leaveTitle" className="px-1 text-xl font-semibold tracking-tight">Leave</h2>
      <div id="leaveCard" className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-xs ring-1 ring-foreground/[0.07]">
        <div className="flex flex-col gap-1">
          <p id="leaveHeadline" className={cn('text-2xl font-semibold tracking-tight', over > 0 && 'text-destructive')}>
            {over > 0 && <TriangleAlertIcon className="mr-2 inline size-6 -translate-y-0.5 align-middle" aria-hidden="true" />}
            {headline}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
        </div>
        <LeaveMeter b={b} />
        {lostNote && <p className={cn('text-sm leading-5', b.carryoverLost > 0 && !b.carryoverExpired ? 'text-ooo-fg' : 'text-muted-foreground')}>{lostNote}</p>}
        {firstOver && (
          <p className="text-sm leading-5 text-destructive">
            You don’t have leave for {over === 1 ? shortDate.format(parse(firstOver)) : `${shortDate.format(parse(firstOver))} onwards`}. Clear some OOO days or raise your allowance in Settings.
            {' '}
            <Button variant="link" className="h-auto p-0 text-sm" onClick={() => setViewDate(parse(firstOver))}>Go to {shortDate.format(parse(firstOver))}</Button>
          </p>
        )}
      </div>
    </section>
  );
}
