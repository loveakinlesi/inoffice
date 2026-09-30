import { Calendar } from '@/components/calendar.tsx';
import { MonthSummary } from '@/components/month-summary.tsx';

export function CalendarPage() {
  return (
    <div id="calendarPage" className="flex flex-col gap-4 md:flex-row md:gap-x-8">
      <MonthSummary />
      <Calendar />
    </div>
  );
}
