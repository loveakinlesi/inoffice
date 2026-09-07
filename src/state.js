import { loadSettings, loadEntries, loadHolidayCache, migrateLegacy } from './storage.js';
export function createState() {
  try { migrateLegacy(); } catch { /* The storage layer displays recovery instructions. */ }
  const now=new Date();
  return {viewDate:new Date(now.getFullYear(),now.getMonth(),1), settings:loadSettings(), entries:loadEntries(), holidayCache:loadHolidayCache(),holidayMessage:'Loading UK bank holidays…'};
}
