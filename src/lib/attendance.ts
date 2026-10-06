import type { AttendanceState, Status } from './types.ts';
export const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const monthKey = (d: Date) => iso(d).slice(0, 7);
export const isWeekday = (d: Date) => d.getDay() > 0 && d.getDay() < 6;
export const isSameDay = (a: Date, b: Date) => iso(a) === iso(b);
export const daysInMonth = (d: Date) => new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
export const getMonthDates = (d: Date) => Array.from({length:daysInMonth(d)},(_,i)=>new Date(d.getFullYear(),d.getMonth(),i+1));
export const formatMonth = (d: Date) => new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(d);
export const getAutoHoliday = (d: Date, s: AttendanceState): string | null => s.holidayCache.data?.[s.settings.region]?.[iso(d)] || null;
export const getStatus = (d: Date, s: AttendanceState): Status | 'blank' => getAutoHoliday(d,s) ? 'bank' : Object.hasOwn(s.entries,iso(d)) ? s.entries[iso(d)] : 'blank';
export interface MonthCounts {
  weekdays: number; bank: number; ooo: number; sick: number; office: number; home: number; blank: number;
  working: number; effective: number; required: number; remaining: number; progress: number; achieved: boolean;
}
export function calculateMonth(date: Date, state: AttendanceState): MonthCounts {
  const c = {weekdays:0, bank:0, ooo:0, sick:0, office:0, home:0, blank:0} as MonthCounts;
  getMonthDates(date).filter(isWeekday).forEach(d=>{
    c.weekdays++;
    const status = getStatus(d,state);
    if (Object.hasOwn(c, status)) c[status]++;
  });
  c.working = c.weekdays-c.bank;
  c.effective = c.working-c.ooo-c.sick;
  c.required = Math.ceil(c.effective*state.settings.targetPercentage/100);
  c.remaining = Math.max(c.required-c.office,0);
  c.progress = c.required ? Math.min(100,c.office/c.required*100) : 100;
  c.achieved = c.remaining === 0;
  return c;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Weekdays before today with nothing logged and no bank holiday: gaps in the record, not absences. */
export function unloggedDays(month: Date, state: AttendanceState, now = new Date()): Date[] {
  const today = startOfDay(now);
  return getMonthDates(month).filter(d => d < today && isWeekday(d) && getStatus(d, state) === 'blank');
}

/** Office days split into done (today or earlier) and planned (after today). */
export function officeSplit(month: Date, state: AttendanceState, now = new Date()): { done: number; planned: number } {
  const today = startOfDay(now);
  let done = 0, planned = 0;
  for (const d of getMonthDates(month)) {
    if (!isWeekday(d) || getStatus(d, state) !== 'office') continue;
    if (d <= today) done++; else planned++;
  }
  return { done, planned };
}
