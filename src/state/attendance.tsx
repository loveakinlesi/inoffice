import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from '@/components/ui/toast.tsx';
import { api, ApiError, NetworkError, type AccountData } from '@/lib/api.ts';
import { authClient, useSession } from '@/lib/auth-client.ts';
import { fetchHolidays } from '@/lib/holidays.ts';
import { monthKey } from '@/lib/attendance.ts';
import { DEFAULT_SETTINGS } from '@/lib/validation.ts';
import {
  loadEntries, loadHolidayCache, loadProfile, loadSettings, migrateLegacy, resetData,
  saveBackup, saveEntries, saveHolidayCache, saveProfile, saveSettings,
} from '@/lib/storage.ts';
import type { BackupData, Entries, HolidayCache, Profile, Settings, Status } from '@/lib/types.ts';

interface StoredState { settings: Settings; entries: Entries; holidayCache: HolidayCache }

/** Signed-in data, loaded from the API. `settings: null` means the account has never saved any. */
interface AccountState { userId: string; status: 'loading' | 'ready' | 'error'; data: AccountData }

export type DataMode = 'local' | 'account';

export interface AttendanceContextValue extends StoredState {
  /** `local` for guests (this browser), `account` when signed in (the API is the source of truth). */
  mode: DataMode;
  /** Load state of account data; null in local mode. */
  accountStatus: AccountState['status'] | null;
  /** Guest data kept in this browser, regardless of mode (used to offer an import on sign-in). */
  localData: { settings: Settings; entries: Entries };
  /** Whether the account already has saved settings; null in local mode or while loading. */
  accountHasSettings: boolean | null;
  online: boolean;
  /** Guest name kept in this browser (null until given). */
  profile: Profile | null;
  /** Name to greet the user by: Google first name when signed in, else the guest's name. */
  firstName: string | null;
  /** Whether we know who this is yet: signed in, or a guest who gave a first name. */
  identified: boolean;
  saveProfile: (profile: Profile) => boolean;
  viewDate: Date;
  holidayMessage: string;
  storageError: string | null;
  setViewDate: (date: Date) => void;
  changeMonth: (offset: number) => void;
  goToToday: () => void;
  /**
   * Each mutation returns false when the change was not applied. In account mode the change is
   * shown immediately and saved in the background; a failed save reloads the account's data.
   */
  saveSettings: (settings: Settings) => boolean;
  setEntry: (date: string, status: Status | null) => boolean;
  resetMonth: (date: Date) => boolean;
  importBackup: (data: BackupData) => boolean;
  resetAll: () => boolean;
  /** Merges this browser's guest data into the account (first sign-in). Resolves false on failure. */
  importLocalIntoAccount: () => Promise<boolean>;
  reloadAccount: () => Promise<void>;
  refreshHolidays: (force?: boolean) => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextValue | null>(null);

const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const emptyCache = (): HolidayCache => ({ fetchedAt: 0, data: {} });
const OFFLINE_MESSAGE = 'You’re offline. Changes can’t be saved until you reconnect.';

function loadStored(): StoredState {
  try { migrateLegacy(); } catch { /* The storage layer reports recovery instructions. */ }
  return { settings: loadSettings(), entries: loadEntries(), holidayCache: loadHolidayCache() };
}

/** Runs a storage write, reporting failure instead of throwing. */
function persist(write: () => void) {
  try { write(); return true; } catch { return false; }
}

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    addEventListener('online', update);
    addEventListener('offline', update);
    return () => { removeEventListener('online', update); removeEventListener('offline', update); };
  }, []);
  return online;
}

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState(loadStored);
  const [account, setAccount] = useState<AccountState | null>(null);
  const [profile, setProfile] = useState(loadProfile);
  const [viewDate, setViewDateState] = useState(() => firstOfMonth(new Date()));
  const [holidayMessage, setHolidayMessage] = useState('Loading UK bank holidays…');
  const [storageError, setStorageError] = useState<string | null>(null);
  const online = useOnline();
  const { data: session } = useSession();
  const userId = session?.user.id ?? null;
  // Latest cache for async refreshes, and counters so only the newest request applies.
  const cacheRef = useRef(stored.holidayCache);
  cacheRef.current = stored.holidayCache;
  const holidayRequest = useRef(0);
  const accountRequest = useRef(0);

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
      setProfile(loadProfile());
    };
    addEventListener('storage', onStorage);
    return () => removeEventListener('storage', onStorage);
  }, []);

  /** Fetches account data. `quiet` keeps the current data on screen instead of showing loading. */
  const loadAccount = useCallback(async (id: string, quiet: boolean) => {
    const request = ++accountRequest.current;
    if (!quiet) setAccount({ userId: id, status: 'loading', data: { settings: null, entries: {} } });
    try {
      const data = await api.getData();
      if (request === accountRequest.current) setAccount({ userId: id, status: 'ready', data });
    } catch (error) {
      if (request !== accountRequest.current) return;
      if (error instanceof ApiError && error.status === 401) { void authClient.getSession(); return; }
      setAccount(a => (quiet && a?.userId === id && a.status === 'ready' ? a : { userId: id, status: 'error', data: { settings: null, entries: {} } }));
    }
  }, []);

  // Switch data source when the signed-in user changes.
  useEffect(() => {
    if (!userId) { accountRequest.current++; setAccount(null); return; }
    void loadAccount(userId, false);
  }, [userId, loadAccount]);

  // Pick up changes made on other devices when the app comes back to the foreground.
  useEffect(() => {
    if (!userId) return;
    const onVisible = () => { if (document.visibilityState === 'visible' && navigator.onLine) void loadAccount(userId, true); };
    document.addEventListener('visibilitychange', onVisible);
    addEventListener('online', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); removeEventListener('online', onVisible); };
  }, [userId, loadAccount]);

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

  const value = useMemo<AttendanceContextValue>(() => {
    const accountMode = account !== null;
    const accountSettings = account?.data.settings ?? { ...DEFAULT_SETTINGS };

    /** Applies an account change optimistically and saves it; a failed save reloads from the server. */
    const remote = (apply: (data: AccountData) => AccountData, save: () => Promise<unknown>) => {
      if (!account || account.status !== 'ready') return false;
      if (!navigator.onLine) { toast.add({ title: OFFLINE_MESSAGE }); return false; }
      setAccount(a => (a ? { ...a, data: apply(a.data) } : a));
      save().catch(error => {
        if (error instanceof ApiError && error.status === 401) {
          toast.add({ title: 'Your session has ended. Sign in again to keep saving changes.' });
          void authClient.getSession();
          return;
        }
        toast.add({ title: error instanceof NetworkError ? OFFLINE_MESSAGE : `Couldn’t save: ${(error as Error).message}` });
        void loadAccount(account.userId, true);
      });
      return true;
    };

    const googleFirstName = session?.user.name.trim().split(/\s+/)[0] || null;
    return {
      mode: accountMode ? 'account' : 'local',
      profile,
      firstName: accountMode ? googleFirstName : profile?.firstName ?? null,
      identified: accountMode || profile !== null,
      saveProfile: next => {
        if (!persist(() => saveProfile(next))) return false;
        setProfile(next);
        return true;
      },
      accountStatus: account?.status ?? null,
      localData: { settings: stored.settings, entries: stored.entries },
      accountHasSettings: account?.status === 'ready' ? account.data.settings !== null : null,
      settings: accountMode ? accountSettings : stored.settings,
      entries: accountMode ? account.data.entries : stored.entries,
      holidayCache: stored.holidayCache,
      online,
      viewDate,
      holidayMessage,
      storageError,
      setViewDate: d => setViewDateState(firstOfMonth(d)),
      changeMonth: offset => setViewDateState(d => new Date(d.getFullYear(), d.getMonth() + offset, 1)),
      goToToday: () => setViewDateState(firstOfMonth(new Date())),
      saveSettings: settings => {
        if (accountMode) return remote(d => ({ ...d, settings }), () => api.saveSettings(settings));
        if (!persist(() => saveSettings(settings))) return false;
        setStored(s => ({ ...s, settings }));
        return true;
      },
      setEntry: (date, status) => {
        const update = (entries: Entries) => {
          const next = { ...entries };
          if (status === null) delete next[date]; else next[date] = status;
          return next;
        };
        if (accountMode) {
          return remote(d => ({ ...d, entries: update(d.entries) }), () => (status === null ? api.deleteEntry(date) : api.setEntry(date, status)));
        }
        const entries = update(stored.entries);
        if (!persist(() => saveEntries(entries))) return false;
        setStored(s => ({ ...s, entries }));
        return true;
      },
      resetMonth: date => {
        const prefix = monthKey(date);
        const without = (entries: Entries) => Object.fromEntries(Object.entries(entries).filter(([d]) => !d.startsWith(prefix)));
        if (accountMode) return remote(d => ({ ...d, entries: without(d.entries) }), () => api.resetMonth(prefix));
        const entries = without(stored.entries);
        if (!persist(() => saveEntries(entries))) return false;
        setStored(s => ({ ...s, entries }));
        return true;
      },
      importBackup: data => {
        if (accountMode) {
          // Holiday data is never stored in the account; keep the backup's cache locally if newer.
          if (data.holidayCache.fetchedAt > stored.holidayCache.fetchedAt && persist(() => saveHolidayCache(data.holidayCache))) {
            cacheRef.current = data.holidayCache;
            setStored(s => ({ ...s, holidayCache: data.holidayCache }));
          }
          return remote(() => ({ settings: data.settings, entries: data.entries }), () => api.importData('replace', data));
        }
        if (!persist(() => saveBackup(data))) return false;
        cacheRef.current = data.holidayCache;
        setStored(data);
        void refreshHolidays();
        return true;
      },
      resetAll: () => {
        if (accountMode) return remote(() => ({ settings: null, entries: {} }), () => api.deleteData());
        if (!persist(resetData)) return false;
        const cleared = { settings: { ...DEFAULT_SETTINGS }, entries: {}, holidayCache: emptyCache() };
        cacheRef.current = cleared.holidayCache;
        setStored(cleared);
        setProfile(null);
        void refreshHolidays();
        return true;
      },
      importLocalIntoAccount: async () => {
        if (!account) return false;
        if (!navigator.onLine) { toast.add({ title: OFFLINE_MESSAGE }); return false; }
        try {
          await api.importData('merge', { settings: stored.settings.onboardingComplete ? stored.settings : null, entries: stored.entries });
          await loadAccount(account.userId, true);
          return true;
        } catch (error) {
          toast.add({ title: error instanceof NetworkError ? OFFLINE_MESSAGE : `Couldn’t import: ${(error as Error).message}` });
          return false;
        }
      },
      reloadAccount: async () => { if (account) await loadAccount(account.userId, false); },
      refreshHolidays,
    };
  }, [stored, account, profile, session, online, viewDate, holidayMessage, storageError, refreshHolidays, loadAccount]);

  return <AttendanceContext value={value}>{children}</AttendanceContext>;
}

export function useAttendance() {
  const ctx = use(AttendanceContext);
  if (!ctx) throw new Error('useAttendance must be used within AttendanceProvider');
  return ctx;
}
