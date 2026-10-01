export type Status = 'home' | 'office' | 'ooo' | 'sick' | 'bank';
export type Region = 'england-and-wales' | 'scotland' | 'northern-ireland';
export type AttendanceMode = 'percentage' | 'days';

export interface Settings {
  attendanceMode: AttendanceMode;
  targetPercentage: number;
  targetDaysPerWeek: number | null;
  region: Region;
  onboardingComplete: boolean;
}

/** ISO date (YYYY-MM-DD) → recorded status. */
export type Entries = Record<string, Status>;

export interface HolidayCache {
  fetchedAt: number;
  /** Region → ISO date → holiday title. */
  data: Partial<Record<Region, Record<string, string>>>;
}

/** The subset of app state the pure attendance functions depend on. */
export interface AttendanceState {
  settings: Settings;
  entries: Entries;
  holidayCache: HolidayCache;
}

export interface AppState extends AttendanceState {
  viewDate: Date;
  holidayMessage: string;
}

/** Guest identity, kept only in this browser. Signed-in users take their name from Google. */
export interface Profile {
  firstName: string;
}

export interface BackupData {
  settings: Settings;
  entries: Entries;
  holidayCache: HolidayCache;
}
