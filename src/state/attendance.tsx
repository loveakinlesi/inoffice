import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { fetchHolidays } from '@/lib/holidays.ts';
import { monthKey } from '@/lib/attendance.ts';
import { DEFAULT_SETTINGS } from '@/lib/validation.ts';
import {
  loadEntries, loadHolidayCache, loadSettings, migrateLegacy, resetData,
  saveBackup, saveEntries, saveHolidayCache, saveSettings,
} from '@/lib/storage.ts';
import type { BackupData, Entries, HolidayCache, Settings, Status } from '@/lib/types.ts';

interface StoredState { settings: Settings; entries: Entries; holidayCache: HolidayCache }

export interface AttendanceContextValue extends StoredState {
  viewDate: Date;
  holidayMessage: string;
  storageError: string | null;
  setViewDate: (date: Date) => void;
  changeMonth: (offset: number) => void;
  goToToday: () => void;
  /** Each mutation returns false when the change could not be persisted. */
  saveSettings: (settings: Settings) => boolean;
  setEntry: (date: string, status: Status | null) => boolean;
  resetMonth: (date: Date) => boolean;
  importBackup: (data: BackupData) => boolean;
  resetAll: () => boolean;
  refreshHolidays: (force?: boolean) => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextValue | null>(null);

const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const emptyCache = (): HolidayCache => ({ fetchedAt: 0, data: {} });

function loadStored(): StoredState {
  try { migrateLegacy(); } catch { /* The storage layer reports recovery instructions. */ }
  return { settings: loadSettings(), entries: loadEntries(), holidayCache: loadHolidayCache() };
}

/** Runs a storage write, reporting failure instead of throwing. */
function persist(write: () => void) {
  try { write(); return true; } catch { return false; }
}

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState(loadStored);
  const [viewDate, setViewDateState] = useState(() => firstOfMonth(new Date()));
  const [holidayMessage, setHolidayMessage] = useState('Loading UK bank holidays…');
  const [storageError, setStorageError] = useState<string | null>(null);
  // Latest cache for async refreshes, and a counter so only the newest request applies.
  const cacheRef = useRef(stored.holidayCache);
  cacheRef.current = stored.holidayCache;
  const holidayRequest = useRef(0);

  useEffect(() => {
    const onError = (e: Event) => setStorageError((e as CustomEvent<string>).detail);
    addEventListener('storage-error', onError);
    return () => removeEventListener('storage-error', onError);
  }, []);

  // Reload shared local state when another tab changes it, preserving the viewed month.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && !e.key.startsWith('inoffice.')) return;
      setStored(loadStored());
    };
    addEventListener('storage', onStorage);
    return () => removeEventListener('storage', onStorage);
  }, []);

  const refreshHolidays = useCallback(async (force = false) => {
    const request = ++holidayRequest.current;
    const result = await fetchHolidays(cacheRef.current, { force });
    if (request !== holidayRequest.current) return;
    let message = result.message;
    if (result.cache !== cacheRef.current) {
      if (persist(() => saveHolidayCache(result.cache))) setStored(s => ({ ...s, holidayCache: result.cache }));
      else message = 'Holiday data could not be saved. Check browser storage and try again.';
    }
    setHolidayMessage(message);
  }, []);

  useEffect(() => { void refreshHolidays(); }, [refreshHolidays]);

  const value = useMemo<AttendanceContextValue>(() => ({
    ...stored,
    viewDate,
    holidayMessage,
    storageError,
    setViewDate: d => setViewDateState(firstOfMonth(d)),
    changeMonth: offset => setViewDateState(d => new Date(d.getFullYear(), d.getMonth() + offset, 1)),
    goToToday: () => setViewDateState(firstOfMonth(new Date())),
    saveSettings: settings => {
      if (!persist(() => saveSettings(settings))) return false;
      setStored(s => ({ ...s, settings }));
      return true;
    },
    setEntry: (date, status) => {
      const entries = { ...stored.entries };
      if (status === null) delete entries[date]; else entries[date] = status;
      if (!persist(() => saveEntries(entries))) return false;
      setStored(s => ({ ...s, entries }));
      return true;
    },
    resetMonth: date => {
      const prefix = monthKey(date);
      const entries = Object.fromEntries(Object.entries(stored.entries).filter(([d]) => !d.startsWith(prefix)));
      if (!persist(() => saveEntries(entries))) return false;
      setStored(s => ({ ...s, entries }));
      return true;
    },
    importBackup: data => {
      if (!persist(() => saveBackup(data))) return false;
      cacheRef.current = data.holidayCache;
      setStored(data);
      void refreshHolidays();
      return true;
    },
    resetAll: () => {
      if (!persist(resetData)) return false;
      const cleared = { settings: { ...DEFAULT_SETTINGS }, entries: {}, holidayCache: emptyCache() };
      cacheRef.current = cleared.holidayCache;
      setStored(cleared);
      void refreshHolidays();
      return true;
    },
    refreshHolidays,
  }), [stored, viewDate, holidayMessage, storageError, refreshHolidays]);

  return <AttendanceContext value={value}>{children}</AttendanceContext>;
}

export function useAttendance() {
  const ctx = use(AttendanceContext);
  if (!ctx) throw new Error('useAttendance must be used within AttendanceProvider');
  return ctx;
}
