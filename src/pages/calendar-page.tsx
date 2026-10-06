import { Calendar } from '@/components/calendar.tsx';
import { CatchUp } from '@/components/catch-up.tsx';
import { PlanUsualDays } from '@/components/plan-usual-days.tsx';
import { MonthSummary } from '@/components/month-summary.tsx';

export function CalendarPage() {
  return (
    <div id="calendarPage" className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,590px)] md:items-start md:gap-x-8">
      <div className="flex min-w-0 flex-col gap-4 md:sticky md:top-24">
        <CatchUp placement="top" />
        <MonthSummary />
        <CatchUp placement="below" />
        <PlanUsualDays />
      </div>
      <Calendar />
    </div>
  );
}
