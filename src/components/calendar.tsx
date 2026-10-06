import { useRef, useState, type KeyboardEvent } from 'react';
import { ContextMenu } from '@base-ui/react/context-menu';
import { ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon, CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import { Button } from '@/components/ui/button.tsx';
import { toast } from '@/components/ui/toast.tsx';
import { STATUS_META } from '@/lib/constants.ts';
import { calculateMonth, daysInMonth, formatMonth, getAutoHoliday, getStatus, isSameDay, isWeekday, iso, officeSplit } from '@/lib/attendance.ts';
import { track } from '@/lib/analytics.ts';
import { useAttendance } from '@/state/attendance.tsx';
import type { Status } from '@/lib/types.ts';

const STATUS_EMOJI: Record<Status, string> = { home: '🏠', office: '🏢', ooo: '🌴', sick: '🤒', bank: '🎉' };
const CYCLE = ['blank', 'office', 'home', 'ooo', 'sick'] as const;
type Choice = (typeof CYCLE)[number];
const PICKABLE = ['office', 'home', 'ooo', 'sick'] as const;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dayLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const longDayLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

const TOAST_TIMEOUT_MS = 5000;
/** When each day's toast is due to close, so a repeat click can update it instead of stacking a new one. */
const dayToastExpiry = new Map<string, number>();

/** One toast per day: changing the same day again updates it (and restarts its timer) instead of stacking. */
function showDayToast(day: Date, title: string, undo?: () => void) {
  const id = `day-${iso(day)}`;
  const actionProps = undo ? { children: 'Undo', onClick: () => { toast.close(id); undo(); } } : undefined;
  const now = Date.now();
  // Leave a margin so we never update a toast that is already animating out.
  if (toastLive(day)) toast.update(id, { title, timeout: TOAST_TIMEOUT_MS, actionProps });
  else toast.add({ id, title, timeout: TOAST_TIMEOUT_MS, actionProps });
  dayToastExpiry.set(id, now + TOAST_TIMEOUT_MS);
}
const toastLive = (day: Date) => (dayToastExpiry.get(`day-${iso(day)}`) ?? 0) - 300 > Date.now();
/** A day's status before the current burst of changes, so Undo goes back to it rather than one tap. */
const dayOrigin = new Map<string, Choice>();
const BLANK_META = { label: 'Blank', classes: 'bg-card text-muted-foreground border-border' };

/**
 * Sets a day's status, then confirms in a toast once it is stored (after the request when signed in):
 * whether it was a plan or a log, what it did to the month, and an Undo back to where the day started.
 */
function useSetDay() {
  const state = useAttendance();
  return (day: Date, next: Choice) => {
    const key = iso(day);
    const previous: Choice = Object.hasOwn(state.entries, key) ? state.entries[key] as Choice : 'blank';
    if (previous === next) return;
    if (!toastLive(day) || !dayOrigin.has(key)) dayOrigin.set(key, previous);
    const describe = (to: Choice) => {
      const entries = { ...state.entries };
      if (to === 'blank') delete entries[key]; else entries[key] = to;
      const after = { ...state, entries };
      const c = calculateMonth(day, after);
      const { done } = officeSplit(day, after);
      const future = day > new Date() && !isSameDay(day, new Date());
      const effect = !c.effective ? '' : done >= c.required ? ' · target met' : c.achieved ? ' · on plan'
        : ` · ${c.remaining} more to ${future ? 'plan' : 'go'}`;
      const when = isSameDay(day, new Date()) ? 'today' : dayLabel.format(day);
      if (to === 'blank') return `Cleared ${when}${effect}`;
      return `${future ? 'Planned' : 'Logged'} ${when}: ${STATUS_META[to].label}${effect}`;
    };
    const apply = (to: Choice, undoable: boolean) => state.setEntry(key, to === 'blank' ? null : to, {
      onSaved: () => showDayToast(day, describe(to), undoable ? () => { const origin = dayOrigin.get(key) ?? 'blank'; dayOrigin.delete(key); apply(origin, false); } : undefined),
    });
    if (apply(next, true)) track('attendance_status_changed');
  };
}

function CalendarNav() {
  const { viewDate, changeMonth, goToToday } = useAttendance();
  const now = new Date();
  const isCurrentMonth = viewDate.getFullYear() === now.getFullYear() && viewDate.getMonth() === now.getMonth();
  const move = (offset: number) => { changeMonth(offset); track('month_changed'); };
  return (
    <div className="calendar-mobile-nav flex items-center gap-2">
      <Button variant="outline" size="icon-lg" aria-label="Previous month" onClick={() => move(-1)}>
        <ChevronLeftIcon />
      </Button>
      <div className="flex flex-1 items-center justify-center gap-2">
        <h2 id="monthTitleMobile" className="truncate text-center text-lg font-semibold tracking-tight">{formatMonth(viewDate)}</h2>
        {!isCurrentMonth && (
          <Button id="todayBtnMobile" variant="outline" size="icon-lg" aria-label="Today" onClick={() => { goToToday(); track('month_changed'); }}>
            <CalendarDaysIcon />
          </Button>
        )}
      </div>
      <Button variant="outline" size="icon-lg" aria-label="Next month" onClick={() => move(1)}>
        <ChevronRightIcon />
      </Button>
    </div>
  );
}

function DayCell({ day, focusable }: { day: Date; focusable: boolean }) {
  const state = useAttendance();
  const setDay = useSetDay();
  const key = iso(day);
  const weekend = !isWeekday(day);
  const holidayName = getAutoHoliday(day, state);
  const hasEntry = Object.hasOwn(state.entries, key);
  const status = weekend ? null : getStatus(day, state);
  const display = weekend ? null : !hasEntry && !holidayName ? 'blank' : status;
  const meta = display && display !== 'blank' ? STATUS_META[display] : BLANK_META;
  const today = isSameDay(day, new Date());
  const locked = Boolean(holidayName);
  // Days after today hold plans rather than a record.
  const planned = !today && day > new Date() && !locked && display !== 'blank' && !weekend;
  const unlogged = !today && day < new Date() && !weekend && display === 'blank';
  const title = weekend ? 'Weekend' : display === 'blank' ? 'Undecided' : holidayName && status === 'bank' ? holidayName : meta.label;
  const spoken = weekend ? 'Weekend' : display === 'blank' ? (day > new Date() ? 'Nothing planned' : 'Not logged') : locked ? `${title}, bank holiday` : planned ? `Planned: ${title}` : title;

  const cycle = () => {
    if (locked) return;
    const current = (hasEntry ? state.entries[key] : 'blank') as Choice;
    setDay(day, CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]!);
  };

  return (
    <button
      type="button"
      disabled={weekend}
      data-date={key}
      title={title}
      tabIndex={focusable ? 0 : -1}
      aria-label={`${longDayLabel.format(day)}, ${spoken}`}
      aria-describedby={weekend || locked ? undefined : 'calendarHint'}
      aria-disabled={locked || undefined}
      aria-current={today ? 'date' : undefined}
      onClick={cycle}
      className={cn(
        'day-cell calendar-day relative flex flex-col text-left transition-[transform,border-color,background-color] duration-150 ease-out',
        weekend ? 'cursor-not-allowed border-transparent bg-muted/50 text-muted-foreground/50'
          : locked ? `${meta.classes} cursor-default`
          : `${meta.classes} hover:border-ring active:scale-[.96]`,
        planned && 'calendar-day-planned',
        unlogged && 'calendar-day-unlogged',
        today && 'border-primary ring-1 ring-inset ring-primary',
      )}
    >
      <span className={cn('calendar-day-number tabular-nums', today && 'calendar-day-today')}>{day.getDate()}</span>
      <span className="calendar-day-emoji" aria-hidden="true">{display && display !== 'blank' ? STATUS_EMOJI[display] : ''}</span>
    </button>
  );
}

/** Teaches the interactions (tap to cycle, hold to choose), that future days are plans, and what each marker means. */
function Legend() {
  return (
    <div className="mt-4 flex flex-col gap-2 border-t pt-4 text-xs text-muted-foreground">
      <p id="calendarHint">
        <span className="pointer-coarse:hidden">Click a weekday to log it, or plan days ahead. Right-click to choose a status.</span>
        <span className="hidden pointer-coarse:inline">Tap a weekday to log it, or plan days ahead. Press and hold to choose a status.</span>
      </p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Status key">
        {(['office', 'home', 'ooo', 'sick', 'bank'] as const).map(s => (
          <li key={s} className="flex items-center gap-1"><span aria-hidden="true">{STATUS_EMOJI[s]}</span>{STATUS_META[s].label}</li>
        ))}
      </ul>
      <p>Dashed days are plans. Dotted days have nothing logged.</p>
    </div>
  );
}

const shiftDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function Calendar() {
  const state = useAttendance();
  const { viewDate } = state;
  const setDay = useSetDay();
  const offset = (new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay() + 6) % 7;
  const total = Math.ceil((offset + daysInMonth(viewDate)) / 7) * 7;
  const cells = Array.from({ length: total }, (_, i) => {
    const dayNum = i - offset + 1;
    return dayNum < 1 || dayNum > daysInMonth(viewDate) ? null : new Date(viewDate.getFullYear(), viewDate.getMonth(), dayNum);
  });
  const weekdays = cells.filter((d): d is Date => d !== null && isWeekday(d));
  const inMonth = (d: Date) => d.getFullYear() === viewDate.getFullYear() && d.getMonth() === viewDate.getMonth();

  // Roving focus: the grid is one tab stop; arrow keys move between weekdays.
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const todayInView = weekdays.find(d => isSameDay(d, new Date()));
  const activeKey = focusKey && weekdays.some(d => iso(d) === focusKey) ? focusKey : iso(todayInView ?? weekdays[0]!);
  const gridRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const from = (e.target as HTMLElement).closest<HTMLElement>('[data-date]')?.dataset.date;
    if (!from) return;
    const current = weekdays.find(d => iso(d) === from);
    if (!current) return;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    let target: Date | undefined;
    if (step) {
      target = shiftDays(current, step);
      while (inMonth(target) && !isWeekday(target)) target = shiftDays(target, Math.sign(step));
    } else if (e.key === 'Home') target = weekdays[0];
    else if (e.key === 'End') target = weekdays.at(-1);
    if (!target) return;
    e.preventDefault();
    if (!inMonth(target)) return;
    setFocusKey(iso(target));
    gridRef.current?.querySelector<HTMLElement>(`[data-date="${iso(target)}"]`)?.focus();
  };

  // One shared picker for the grid: right-click or press-and-hold on a weekday chooses its status directly.
  const [picked, setPicked] = useState<Date | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pickFrom = (target: EventTarget) => {
    const key = (target as HTMLElement).closest<HTMLElement>('[data-date]')?.dataset.date;
    const day = key ? weekdays.find(d => iso(d) === key) : undefined;
    setPicked(day && !getAutoHoliday(day, state) ? day : null);
  };
  const pickedKey = picked ? iso(picked) : null;
  const pickedCurrent: Choice | null = pickedKey ? (Object.hasOwn(state.entries, pickedKey) ? state.entries[pickedKey] as Choice : 'blank') : null;

  return (
    <section id="calendarCard" className="calendar-card overflow-hidden rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.07]">
      <div className="calendar-header border-b px-4 py-4">
        <CalendarNav />
      </div>
      <div className="min-w-0 p-4">
        <div className="calendar-grid calendar-weekdays grid" aria-hidden="true">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={cn('px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider', i < 5 ? 'text-muted-foreground' : 'text-muted-foreground/60')}>{d}</div>
          ))}
        </div>
        <ContextMenu.Root open={menuOpen && picked !== null} onOpenChange={open => setMenuOpen(open)}>
          <ContextMenu.Trigger
            render={<div ref={gridRef} />}
            id="calendar"
            role="group"
            aria-label={`${formatMonth(viewDate)} attendance`}
            className="calendar-grid calendar-days grid select-none [-webkit-touch-callout:none]"
            onKeyDown={onKeyDown}
            onFocus={e => { const k = (e.target as HTMLElement).dataset.date; if (k) setFocusKey(k); }}
            onPointerDownCapture={e => pickFrom(e.target)}
            onContextMenuCapture={e => pickFrom(e.target)}
          >
            {cells.map((day, i) => day
              ? <DayCell key={iso(day)} day={day} focusable={iso(day) === activeKey} />
              : <div key={`pad-${i}`} className="day-cell calendar-compact-cell border-none bg-transparent" />)}
          </ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner className="isolate z-50 outline-none">
              <ContextMenu.Popup className="z-50 min-w-44 origin-(--transform-origin) rounded-xl bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
                {picked && <p className="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">{longDayLabel.format(picked)}</p>}
                {[...PICKABLE, 'blank' as const].map(choice => (
                  <ContextMenu.Item
                    key={choice}
                    onClick={() => { if (picked) setDay(picked, choice); }}
                    className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  >
                    <span aria-hidden="true" className="w-5 text-center">{choice === 'blank' ? '' : STATUS_EMOJI[choice]}</span>
                    <span className="flex-1">{choice === 'blank' ? 'Clear' : STATUS_META[choice].label}</span>
                    {pickedCurrent === choice && <CheckIcon className="size-4 text-primary" aria-label="Current" />}
                  </ContextMenu.Item>
                ))}
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
        <Legend />
      </div>
    </section>
  );
}
