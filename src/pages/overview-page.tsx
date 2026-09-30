import { useNavigate } from 'react-router';
import { cn } from '@/lib/utils.ts';
import { Badge } from '@/components/ui/badge.tsx';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { calculateMonth } from '@/lib/attendance.ts';
import { track } from '@/lib/analytics.ts';
import { useAttendance } from '@/state/attendance.tsx';

const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long' });

export function OverviewPage() {
  const state = useAttendance();
  const navigate = useNavigate();
  const year = state.viewDate.getFullYear();

  return (
    <Card id="overviewPage" aria-labelledby="overviewTitlePage" className="mx-auto w-full max-w-5xl shadow-card">
      <CardHeader className="border-b">
        <CardTitle id="overviewTitlePage" className="text-xl font-semibold tracking-tight">{year} overview</CardTitle>
        <CardDescription>Monthly compliance at a glance.</CardDescription>
      </CardHeader>
      <div id="overviewGridPage" className="grid gap-3 px-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }, (_, month) => {
          const date = new Date(year, month, 1);
          const c = calculateMonth(date, state);
          const status = !c.effective ? 'No effective days' : c.achieved ? 'Achieved' : new Date(year, month + 1, 1) <= new Date() ? 'Missed' : 'In progress';
          return (
            <button
              key={month}
              type="button"
              data-overview-month={month}
              onClick={() => { state.setViewDate(date); navigate('/'); track('month_changed'); }}
              className="rounded-2xl border bg-card p-4 text-left transition hover:border-foreground/20 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{monthName.format(date)}</span>
                <Badge variant={c.achieved ? 'default' : 'secondary'} className={cn(c.achieved && 'bg-emerald-100 text-emerald-800')}>{status}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {([['Office', c.office], ['Required', c.required], ['Working days', c.working]] as const).map(([label, n]) => (
                  <div key={label}>
                    <p className="text-lg font-semibold">{n}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full', c.achieved ? 'bg-emerald-500' : 'bg-slate-400')} style={{ width: `${c.progress}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
