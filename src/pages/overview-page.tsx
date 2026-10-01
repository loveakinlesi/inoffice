import { useNavigate } from 'react-router';
import { cn } from '@/lib/utils.ts';
import { Badge } from '@/components/ui/badge.tsx';
import { calculateMonth } from '@/lib/attendance.ts';
import { track } from '@/lib/analytics.ts';
import { useAttendance } from '@/state/attendance.tsx';

const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long' });

export function OverviewPage() {
  const state = useAttendance();
  const navigate = useNavigate();
  const year = state.viewDate.getFullYear();

  return (
    <div id="overviewPage" aria-labelledby="overviewTitlePage" className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="px-1">
        <h1 id="overviewTitlePage" className="text-2xl font-semibold tracking-tight">{year} overview</h1>
        <p className="text-sm text-muted-foreground">Monthly compliance at a glance. Select a month to open it.</p>
      </div>
      <div id="overviewGridPage" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }, (_, month) => {
          const date = new Date(year, month, 1);
          const c = calculateMonth(date, state);
          const past = new Date(year, month + 1, 1) <= new Date();
          const status = !c.effective ? 'No effective days' : c.achieved ? 'Achieved' : past ? 'Missed' : 'In progress';
          return (
            <button
              key={month}
              type="button"
              data-overview-month={month}
              onClick={() => { state.setViewDate(date); navigate('/'); track('month_changed'); }}
              className="flex flex-col gap-4 rounded-2xl bg-card p-4 text-left shadow-xs ring-1 ring-foreground/[0.07] transition hover:shadow-md hover:ring-foreground/15"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{monthName.format(date)}</span>
                <Badge
                  variant="secondary"
                  className={cn(
                    status === 'Achieved' && 'bg-emerald-50 text-emerald-700',
                    status === 'Missed' && 'bg-rose-50 text-rose-700',
                  )}
                >
                  {status}
                </Badge>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-semibold tracking-tight tabular-nums">{c.office}</span>
                <span className="text-sm text-muted-foreground tabular-nums">/ {c.required} office days</span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{c.working} working</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full', c.achieved ? 'bg-emerald-500' : 'bg-foreground/30')} style={{ width: `${c.progress}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
