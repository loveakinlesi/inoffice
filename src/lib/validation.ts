import { REGION_NAMES, STATUS_ORDER } from './constants.ts';
import { iso } from './attendance.ts';
import type { BackupData, Entries, HolidayCache, Profile, Settings } from './types.ts';
export const DEFAULT_SETTINGS: Settings = { attendanceMode:'percentage', targetPercentage:50, targetDaysPerWeek:null, region:'england-and-wales', onboardingComplete:false };
const object = (x: unknown): x is Record<string, any> => x !== null && typeof x === 'object' && !Array.isArray(x);
export function validDate(value: unknown): value is string {
  if (typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && iso(date)===value;
}
export function validSettings(s: unknown): s is Settings {
  return object(s) && ['percentage','days'].includes(s.attendanceMode) &&
    Number.isFinite(s.targetPercentage) && s.targetPercentage>=5 && s.targetPercentage<=100 &&
    Object.hasOwn(REGION_NAMES,s.region) && typeof s.onboardingComplete==='boolean' &&
    (s.attendanceMode==='percentage' ? s.targetDaysPerWeek===null :
      Number.isFinite(s.targetDaysPerWeek) && s.targetDaysPerWeek>=1 && s.targetDaysPerWeek<=5 &&
      Number.isInteger(s.targetDaysPerWeek*2) && Math.abs(s.targetDaysPerWeek/5*100-s.targetPercentage)<1e-8);
}
export const MAX_FIRST_NAME_LENGTH = 50;
/** Trimmed first name, or null when empty or too long. */
export function normalizeFirstName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  return name.length > 0 && name.length <= MAX_FIRST_NAME_LENGTH ? name : null;
}
export const validProfile = (p: unknown): p is Profile => object(p) && normalizeFirstName(p.firstName) === p.firstName;
export const validEntries = (e: unknown): e is Entries => object(e) && Object.entries(e).every(([d,s])=>validDate(d)&&STATUS_ORDER.includes(s));
export function validCache(c: unknown): c is HolidayCache {
  return object(c) && Number.isFinite(c.fetchedAt) && c.fetchedAt>=0 && object(c.data) &&
    Object.entries(c.data).every(([r,dates])=>Object.hasOwn(REGION_NAMES,r)&&object(dates)&&Object.entries(dates).every(([d,t])=>validDate(d)&&typeof t==='string'&&t.length<=500));
}
export function validateBackup(p: any): BackupData {
  if (!object(p) || p.app!=='InOffice' || p.version!==1 || typeof p.exportedAt!=='string' || Number.isNaN(Date.parse(p.exportedAt)) || !validSettings(p.settings) || !validEntries(p.entries) || !validCache(p.holidayCache)) {
    throw new Error('This is not a valid InOffice v1 backup. Choose a JSON file exported from InOffice.');
  }
  return { settings:pickSettings(p.settings), entries:p.entries, holidayCache:p.holidayCache };
}
export const pickSettings = (s: Settings): Settings => Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map(k=>[k,s[k as keyof Settings]])) as unknown as Settings;
