import { getMonthDates, isWeekday, getStatus, iso, type MonthCounts } from './attendance.ts';
import type { AttendanceState } from './types.ts';
export function forecast(date: Date, counts: MonthCounts, state: AttendanceState, today=new Date()) {
  // Already recorded office days are included in progress, never counted twice.
  const eligible = getMonthDates(date).filter(d=>iso(d)>=iso(today)&&isWeekday(d)&&getStatus(d,state)==='blank').length;
  return { remaining:counts.remaining, eligible, achievable:eligible>=counts.remaining };
}
export function forecastMonth(date: Date, counts: MonthCounts, state: AttendanceState, today=new Date()) {
  const f=forecast(date,counts,state,today);
  if (!counts.effective) return 'No effective working days this month. There is no office target to meet.';
  if (counts.achieved) return 'Target achieved. Any additional office days are above target.';
  const days = (n: number) => `${n} more office day${n===1?'':'s'}`;
  return f.achievable ? `${days(f.remaining)} needed. ${f.eligible} eligible workdays remain, so your target is achievable.` : `${days(f.remaining)} are needed, but only ${f.eligible} eligible workdays remain.`;
}
