import { DEFAULT_SETTINGS, validSettings, validEntries, validCache } from './validation.ts';
import type { BackupData, Entries, HolidayCache, Settings } from './types.ts';
export const KEYS = {settings:'inoffice.settings.v1',entries:'inoffice.entries.v1',holidays:'inoffice.holidays.v1'};
type Kind = keyof typeof KEYS;
const emptyCache = (): HolidayCache => ({fetchedAt:0,data:{}});
function report(message: string) { globalThis.dispatchEvent?.(new CustomEvent('storage-error',{detail:message})); }
function read(key: string): unknown {
  try { const raw=localStorage.getItem(key); return raw===null ? null : JSON.parse(raw); }
  catch { report('Saved data could not be read. Export a backup before resetting data, and check that browser storage is enabled.'); return null; }
}
function load<T>(kind: Kind, fallback: T, validate: (x: unknown) => x is T): T {
  const data=read(KEYS[kind]);
  if (data===null) return fallback;
  if (validate(data)) return data;
  report('Some saved InOffice data is invalid. Restore a valid backup in Settings.');
  return fallback;
}
function save(kind: Kind, value: unknown) {
  try { localStorage.setItem(KEYS[kind],JSON.stringify(value)); }
  catch { report('Changes could not be saved. Browser storage may be full or blocked. Free space or enable storage, then try again.'); throw new Error('Storage unavailable'); }
}
export const loadSettings = () => load('settings',{...DEFAULT_SETTINGS},validSettings);
export const loadEntries = () => load<Entries>('entries',{},validEntries);
export const loadHolidayCache = () => load('holidays',emptyCache(),validCache);
export const saveSettings = (s: Settings) => save('settings',s);
export const saveEntries = (e: Entries) => save('entries',e);
export const saveHolidayCache = (c: HolidayCache) => save('holidays',c);
export function saveBackup(data: BackupData) {
  const previous = Object.fromEntries(Object.entries(KEYS).map(([kind,key])=>[kind,localStorage.getItem(key)])) as Record<Kind, string | null>;
  try { saveEntries(data.entries); saveHolidayCache(data.holidayCache); saveSettings(data.settings); }
  catch(error) {
    for (const [kind,raw] of Object.entries(previous) as [Kind, string | null][]) {
      try { raw===null ? localStorage.removeItem(KEYS[kind]) : localStorage.setItem(KEYS[kind],raw); } catch { /* Best effort rollback when storage becomes unavailable. */ }
    }
    throw error;
  }
}
export function resetData() {
  try {
    for (const key of [...Object.values(KEYS), ...['settings','entries','holidays'].map(k=>`office-attendance.${k}.v1`)]) localStorage.removeItem(key);
  } catch { report('Data could not be reset. Enable browser storage and try again.'); throw new Error('Storage unavailable'); }
}
export function migrateLegacy() {
  if (read(KEYS.settings)!==null) return;
  const settings=read('office-attendance.settings.v1') as {target?: unknown; region?: Settings['region']} | null;
  const entries=read('office-attendance.entries.v1');
  if (!settings && !entries) return;
  const migrated={...DEFAULT_SETTINGS, targetPercentage:Math.min(100,Math.max(5,Number(settings?.target)||50)),region:settings?.region||DEFAULT_SETTINGS.region,onboardingComplete:true};
  if (!validSettings(migrated)||!validEntries(entries||{})) return;
  const cache=read('office-attendance.holidays.v1');
  saveBackup({settings:migrated,entries:(entries||{}) as Entries,holidayCache:validCache(cache)?cache:emptyCache()});
}
