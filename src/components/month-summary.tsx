import { Card } from '@/components/ui/card.tsx';
import { Progress } from '@/components/ui/progress.tsx';
import { calculateMonth, formatMonth } from '@/lib/attendance.ts';
import { useAttendance } from '@/state/attendance.tsx';

function StatTile({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <Card size="sm" className="gap-1 px-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="text-xs leading-4 text-muted-foreground">{note}</p>
    </Card>
  );
}

export function MonthSummary() {
  const state = useAttendance();
  const { settings, viewDate, firstName } = state;
  const c = calculateMonth(viewDate, state);
  const requiredPct = c.effective ? Math.round((c.required / c.effective) * 100) : 0;
  const currentPct = c.effective ? Math.round((c.office / c.effective) * 100) : 100;
  const percentageMode = settings.attendanceMode === 'percentage';
  const status = !c.effective ? 'No office target this month'
    : c.achieved ? 'Target met for this month'
    : `${c.remaining} more office day${c.remaining === 1 ? '' : 's'} to go`;

  return (
    <section aria-labelledby="summaryTitle" className="flex min-w-0 flex-1 flex-col gap-3">
      <div>
        <h2 id="summaryTitle" className="text-2xl font-semibold tracking-tight sm:text-xl">
          {firstName ? `Hi ${firstName}` : 'Monthly summary'}
        </h2>
        <p id="summaryMonth" className="text-sm text-muted-foreground">{formatMonth(viewDate)}</p>
      </div>
      <div id="statsGrid" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card size="sm" className="col-span-2 gap-3 px-4 lg:col-span-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Days in office</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                {c.office}<span className="text-xl text-muted-foreground">/{c.required}</span>
              </p>
            </div>
            <p className="text-sm font-medium tabular-nums text-muted-foreground">{c.progress.toFixed(0)}%</p>
          </div>
          <Progress
            value={Math.round(c.progress)}
            aria-label="Office days progress"
            getAriaValueText={() => `${c.office} of ${c.required} required office days`}
            className="[&_[data-slot=progress-indicator]]:bg-emerald-500 [&_[data-slot=progress-track]]:h-2"
          />
          <p id="statusMessage" className="text-sm font-medium">{status}</p>
        </Card>
        {percentageMode && <StatTile label="Current" value={`${currentPct}%`} note="Of effective days" />}
        <StatTile
          label="Required"
          value={c.required}
          note={percentageMode
            ? `${settings.targetPercentage}% target${c.effective ? ` (${requiredPct}%)` : ''}`
            : `${settings.targetDaysPerWeek} days a week`}
        />
        <StatTile label="Working days" value={c.working} note="Weekdays minus holidays" />
        <StatTile label="Leave days" value={c.ooo + c.sick} note="OOO and sick" />
        <StatTile label="Bank holidays" value={c.bank} note="Excluded from target" />
      </div>
    </section>
  );
}
