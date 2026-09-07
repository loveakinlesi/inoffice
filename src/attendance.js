export const pad = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const monthKey = d => iso(d).slice(0, 7);
export const isWeekday = d => d.getDay() > 0 && d.getDay() < 6;
export const isSameDay = (a,b) => iso(a) === iso(b);
export const daysInMonth = d => new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
export const getMonthDates = d => Array.from({length:daysInMonth(d)},(_,i)=>new Date(d.getFullYear(),d.getMonth(),i+1));
export const formatMonth = d => new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(d);
export const getAutoHoliday = (d,s) => s.holidayCache.data?.[s.settings.region]?.[iso(d)] || null;
export const getStatus = (d,s) => Object.hasOwn(s.entries,iso(d)) ? s.entries[iso(d)] : getAutoHoliday(d,s) ? 'bank' : 'home';
export function calculateMonth(date,state) {
  const c = {weekdays:0, bank:0, ooo:0, office:0, home:0};
  getMonthDates(date).filter(isWeekday).forEach(d=>{ c.weekdays++; c[getStatus(d,state)]++; });
  c.working = c.weekdays-c.bank-c.ooo;
  c.required = Math.ceil(c.working*state.settings.targetPercentage/100);
  c.remaining = Math.max(c.required-c.office,0);
  c.progress = c.required ? Math.min(100,c.office/c.required*100) : 100;
  c.achieved = c.remaining === 0;
  return c;
}
