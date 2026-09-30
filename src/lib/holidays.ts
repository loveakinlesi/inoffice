import { REGION_NAMES } from './constants.ts';
import { validCache, validDate } from './validation.ts';
import type { AppState, HolidayCache, Region } from './types.ts';
export const HOLIDAY_URL = 'https://www.gov.uk/bank-holidays.json';
export function normalizeHolidays(json: any): HolidayCache {
  const data: HolidayCache['data']={};
  for (const region of Object.keys(REGION_NAMES) as Region[]) {
    if (!Array.isArray(json?.[region]?.events) || !json[region].events.length) throw new Error('Invalid holiday response');
    const dates: Record<string, string>={};
    for (const event of json[region].events) {
      if (!validDate(event.date)||typeof event.title!=='string') throw new Error('Invalid holiday event');
      dates[event.date]=event.title;
    }
    data[region]=dates;
  }
  const cache={fetchedAt:Date.now(),data};
  if (!validCache(cache)) throw new Error('Invalid holiday response');
  return cache;
}
export async function fetchHolidays(cache: HolidayCache, {fetcher=fetch as (url: string, init?: RequestInit) => Promise<Pick<Response,'ok'|'json'>>, force=false}={}) {
  const hasCache=Object.keys(cache.data).length>0;
  if (!force && hasCache && Date.now()-cache.fetchedAt<7*86400000) return {cache,message:'Using cached UK bank holidays.'};
  try {
    const response=await fetcher(HOLIDAY_URL,{signal:AbortSignal.timeout(10000),cache:'no-store'});
    if (!response.ok) throw new Error('Holiday service unavailable');
    return {cache:normalizeHolidays(await response.json()),message:'UK bank holidays are up to date.'};
  } catch {
    return {cache,message:hasCache ? 'Could not refresh bank holidays. Using cached data.' : 'Bank holidays could not be loaded. Mark them manually or try again.'};
  }
}
export function holidayCoverage(state: Pick<AppState,'viewDate'|'holidayCache'|'settings'>) {
  const year=state.viewDate.getFullYear();
  const dates=Object.keys(state.holidayCache.data[state.settings.region]||{});
  return dates.some(d=>d.startsWith(`${year}-`)) ? '' : ` No automatic holidays available for ${year}; try refreshing later.`;
}
