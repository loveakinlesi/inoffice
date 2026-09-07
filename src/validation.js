import { REGION_NAMES, STATUS_ORDER } from './constants.js';
import { iso } from './attendance.js';
export const DEFAULT_SETTINGS = { attendanceMode:'percentage', targetPercentage:50, targetDaysPerWeek:null, region:'england-and-wales', onboardingComplete:false };
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && iso(date)===value;
}
export function validSettings(s) {
  return object(s) && ['percentage','days'].includes(s.attendanceMode) &&
    Number.isFinite(s.targetPercentage) && s.targetPercentage>=5 && s.targetPercentage<=100 &&
    Object.hasOwn(REGION_NAMES,s.region) && typeof s.onboardingComplete==='boolean' &&
    (s.attendanceMode==='percentage' ? s.targetDaysPerWeek===null :
      Number.isFinite(s.targetDaysPerWeek) && s.targetDaysPerWeek>=1 && s.targetDaysPerWeek<=5 &&
      Number.isInteger(s.targetDaysPerWeek*2) && Math.abs(s.targetDaysPerWeek/5*100-s.targetPercentage)<1e-8);
}
export const validEntries = e => object(e) && Object.entries(e).every(([d,s])=>validDate(d)&&STATUS_ORDER.includes(s));
export function validCache(c) {
  return object(c) && Number.isFinite(c.fetchedAt) && c.fetchedAt>=0 && object(c.data) &&
    Object.entries(c.data).every(([r,dates])=>Object.hasOwn(REGION_NAMES,r)&&object(dates)&&Object.entries(dates).every(([d,t])=>validDate(d)&&typeof t==='string'&&t.length<=500));
}
export function validateBackup(p) {
  if (!object(p) || p.app!=='InOffice' || p.version!==1 || typeof p.exportedAt!=='string' || Number.isNaN(Date.parse(p.exportedAt)) || !validSettings(p.settings) || !validEntries(p.entries) || !validCache(p.holidayCache)) {
    throw new Error('This is not a valid InOffice v1 backup. Choose a JSON file exported from InOffice.');
  }
  return { settings:pickSettings(p.settings), entries:p.entries, holidayCache:p.holidayCache };
}
export const pickSettings = s => Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map(k=>[k,s[k]]));
