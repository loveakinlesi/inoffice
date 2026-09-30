import { Link } from 'react-router';
import { cn } from '@/lib/utils.ts';
import { buttonVariants } from '@/components/ui/button.tsx';
import { Card } from '@/components/ui/card.tsx';
import { Progress } from '@/components/ui/progress.tsx';
import { calculateMonth, formatMonth } from '@/lib/attendance.ts';
import { track } from '@/lib/analytics.ts';
import { useAttendance } from '@/state/attendance.tsx';

function StatCard({ title, value, note }: { title: string; value: string | number; note?: string }) {
  return (
    <Card size="sm" className="min-w-[min(10.5rem,100%)] max-w-full flex-1 gap-1 px-3 shadow-card sm:max-w-[15rem] sm:px-4">
      <p className="text-base font-medium text-muted-foreground">{title}</p>
      <p className="text-xl font-bold tracking-tight sm:text-2xl">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </Card>
  );
}

export function MonthSummary() {
  const state = useAttendance();
  const { settings, viewDate } = state;
  const c = calculateMonth(viewDate, state);
  const requiredPct = c.effective ? Math.round((c.required / c.effective) * 100) : 0;
  const currentPct = c.effective ? Math.round((c.office / c.effective) * 100) : 100;
  const percentageMode = settings.attendanceMode === 'percentage';

  return (
    <section aria-labelledby="summaryTitle" className="flex-1">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 id="summaryTitle" className="text-base font-semibold">Monthly summary</h2>
          <p id="summaryMonth" className="text-xs text-muted-foreground sm:hidden">{formatMonth(viewDate)}</p>
          <p className="hidden text-sm text-muted-foreground sm:block">Calculated from weekdays and your recorded attendance.</p>
        </div>
        <Link
          id="overviewBtnMobile"
          to="/overview"
          onClick={() => track('year_overview_opened')}
          className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'shrink-0 sm:hidden')}
        >
          Year overview
        </Link>
      </div>
      <div id="statsGrid" className="flex flex-wrap gap-2 sm:gap-3">
        <Card size="sm" className="min-w-full max-w-full flex-1 gap-3 px-3 shadow-card sm:min-w-[20rem] sm:max-w-[28rem] sm:px-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Days in Office</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{c.office}/{c.required}</p>
            </div>
            <p className="text-sm font-semibold text-muted-foreground">{c.progress.toFixed(0)}%</p>
          </div>
          <Progress
            value={Math.round(c.progress)}
            aria-label="Office days progress"
            getAriaValueText={() => `${c.office} of ${c.required} required office days`}
            className="[&_[data-slot=progress-indicator]]:bg-emerald-500 [&_[data-slot=progress-track]]:h-2.5"
          />
        </Card>
        {percentageMode && <StatCard title="Current" value={`${currentPct}%`} note="Office days as a share of effective days" />}
        <StatCard
          title="Required"
          value={c.required}
          note={percentageMode
            ? `${settings.targetPercentage}% of effective days${c.effective ? ` (${requiredPct}%)` : ''}`
            : `${settings.targetDaysPerWeek} office days per week`}
        />
        <StatCard title="Working days" value={c.working} note="Weekdays minus bank holidays" />
        <StatCard title="Leave days" value={c.ooo + c.sick} note="OOO + sick days" />
        <StatCard title="Bank holidays" value={c.bank} note="Public holidays excluded from target" />
      </div>
    </section>
  );
}
