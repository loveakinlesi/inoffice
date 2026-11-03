import { isWeekday, getStatus, iso } from './attendance.ts';
import type { AttendanceState, LeaveSettings } from './types.ts';

/**
 * Leave is the days marked OOO on weekdays that are not bank holidays. A leave cycle runs from its
 * start date to the day before the next one; carryover belongs to a single cycle, keyed by that
 * cycle's start date (YYYY-MM-DD), and is spent before the cycle's own allowance until it expires.
 */
export const DEFAULT_LEAVE: LeaveSettings = { cycleStartMonth: 1, cycleStartDay: 1, allowance: 25, carryover: {} };

const MAX_DAY_OF_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** The last real day of that month in that year, so a 29 Feb cycle start still lands in non-leap years. */
const clampDay = (year: number, month: number, day: number) => Math.min(day, new Date(year, month, 0).getDate());
const cycleStartIn = (year: number, l: Pick<LeaveSettings, 'cycleStartMonth' | 'cycleStartDay'>) =>
  new Date(year, l.cycleStartMonth - 1, clampDay(year, l.cycleStartMonth, l.cycleStartDay));
export const maxDayForMonth = (month: number) => MAX_DAY_OF_MONTH[month - 1] ?? 31;

export interface LeaveCycle { key: string; start: Date; /** Inclusive last day. */ end: Date; label: string }

const yearLabel = (start: Date, end: Date) => start.getFullYear() === end.getFullYear() ? String(start.getFullYear()) : `${start.getFullYear()}/${String(end.getFullYear()).slice(2)}`;

/** The leave cycle containing `date`. */
export function cycleFor(date: Date, l: LeaveSettings): LeaveCycle {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const thisYear = cycleStartIn(day.getFullYear(), l);
  const start = day >= thisYear ? thisYear : cycleStartIn(day.getFullYear() - 1, l);
  const nextStart = cycleStartIn(start.getFullYear() + 1, l);
  const end = new Date(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate() - 1);
  return { key: iso(start), start, end, label: yearLabel(start, end) };
}

/** The cycle that begins the day after `cycle` ends. */
export const nextCycle = (cycle: LeaveCycle, l: LeaveSettings) => cycleFor(new Date(cycle.end.getFullYear(), cycle.end.getMonth(), cycle.end.getDate() + 1), l);
export const previousCycle = (cycle: LeaveCycle, l: LeaveSettings) => cycleFor(new Date(cycle.start.getFullYear(), cycle.start.getMonth(), cycle.start.getDate() - 1), l);

/** Default "use by" date for carryover: three months into the cycle, a common policy. */
export function defaultCarryoverExpiry(cycle: LeaveCycle): string {
  const d = new Date(cycle.start.getFullYear(), cycle.start.getMonth() + 3, cycle.start.getDate() - 1);
  return iso(d > cycle.end ? cycle.end : d);
}

export interface LeaveBalance {
  cycle: LeaveCycle;
  allowance: number;
  carryover: number;
  /** Last day carried days can be used (null = they never expire). */
  carryoverExpires: string | null;
  /** Leave days in the cycle: taken (today or earlier) and planned (after today). */
  taken: number;
  planned: number;
  used: number;
  /** Carried days used before they expired, and carried days that will be (or were) lost. */
  carryoverUsed: number;
  carryoverLost: number;
  carryoverExpired: boolean;
  /** Days still free to book: allowance + usable carryover - used. Negative when over-booked. */
  remaining: number;
  /** Leave days past what the cycle gives you, in date order. */
  overdrawn: string[];
}

/** OOO weekdays (not bank holidays) inside the cycle, as ISO dates in order. */
export function leaveDates(cycle: LeaveCycle, state: AttendanceState): string[] {
  const out: string[] = [];
  for (let d = new Date(cycle.start); d <= cycle.end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    if (isWeekday(d) && getStatus(d, state) === 'ooo') out.push(iso(d));
  }
  return out;
}

export function calculateLeave(cycle: LeaveCycle, leave: LeaveSettings, state: AttendanceState, now = new Date()): LeaveBalance {
  const today = iso(now);
  const carry = leave.carryover[cycle.key];
  const carryover = carry?.days ?? 0;
  const carryoverExpires = carry && carryover > 0 ? carry.expires : null;
  const dates = leaveDates(cycle, state);

  // Spend carried days first, but only on days up to their expiry; everything else draws on the allowance.
  let carryLeft = carryover;
  let carryoverUsed = 0;
  let allowanceLeft = leave.allowance;
  const overdrawn: string[] = [];
  for (const date of dates) {
    if (carryLeft > 0 && (carryoverExpires === null || date <= carryoverExpires)) { carryLeft--; carryoverUsed++; }
    else if (allowanceLeft >= 1) allowanceLeft--;
    else overdrawn.push(date);
  }
  // Carried days left once the expiry has passed (or will pass within this cycle) are lost.
  const carryoverLost = carryoverExpires === null ? 0 : carryLeft;
  const used = dates.length;
  const taken = dates.filter(d => d <= today).length;
  return {
    cycle, allowance: leave.allowance, carryover, carryoverExpires,
    taken, planned: used - taken, used, carryoverUsed, carryoverLost,
    carryoverExpired: carryoverExpires !== null && carryoverExpires < today,
    remaining: leave.allowance + carryover - carryoverLost - used,
    overdrawn,
  };
}

export const isOverdrawn = (b: LeaveBalance) => b.overdrawn.length > 0;

/** The cycle's balance if `date` were marked OOO, when that would put it further over its allowance. */
export function wouldOverdraw(date: Date, leave: LeaveSettings, state: AttendanceState, now = new Date()): LeaveBalance | null {
  if (!isWeekday(date) || getStatus(date, state) === 'bank') return null;
  const cycle = cycleFor(date, leave);
  const before = calculateLeave(cycle, leave, state, now);
  const after = calculateLeave(cycle, leave, { ...state, entries: { ...state.entries, [iso(date)]: 'ooo' } }, now);
  return after.overdrawn.length > before.overdrawn.length ? after : null;
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const formatDays = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export const cycleStartLabel = (l: Pick<LeaveSettings, 'cycleStartMonth' | 'cycleStartDay'>) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(new Date(2024, l.cycleStartMonth - 1, l.cycleStartDay));
