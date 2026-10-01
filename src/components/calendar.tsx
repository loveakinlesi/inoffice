import { ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon } from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import { Button } from '@/components/ui/button.tsx';
import { toast } from '@/components/ui/toast.tsx';
import { STATUS_META } from '@/lib/constants.ts';
import { daysInMonth, formatMonth, getAutoHoliday, getStatus, isSameDay, isWeekday, iso } from '@/lib/attendance.ts';
import { track } from '@/lib/analytics.ts';
import { useAttendance } from '@/state/attendance.tsx';
import type { Status } from '@/lib/types.ts';

const STATUS_EMOJI: Record<Status, string> = { home: '🏠', office: '🏢', ooo: '🌴', sick: '🤒', bank: '🎉' };
const CYCLE = ['blank', 'office', 'home', 'ooo', 'sick'] as const;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dayLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

const TOAST_TIMEOUT_MS = 4000;
/** When each day's toast is due to close, so a repeat click can update it instead of stacking a new one. */
const dayToastExpiry = new Map<string, number>();

/** One toast per day: clicking the same day again updates it (and restarts its timer) instead of stacking. */
function showDayToast(day: Date, label: string) {
  const id = `day-${iso(day)}`;
  const title = `${dayLabel.format(day)}: ${label}`;
  const now = Date.now();
  // Leave a margin so we never update a toast that is already animating out.
  if ((dayToastExpiry.get(id) ?? 0) - 300 > now) toast.update(id, { title, timeout: TOAST_TIMEOUT_MS });
  else toast.add({ id, title, timeout: TOAST_TIMEOUT_MS });
  dayToastExpiry.set(id, now + TOAST_TIMEOUT_MS);
}
const BLANK_META = { label: 'Blank', classes: 'bg-white text-slate-500 border-slate-200' };

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

function DayCell({ day }: { day: Date }) {
  const state = useAttendance();
  const key = iso(day);
  const weekend = !isWeekday(day);
  const holidayName = getAutoHoliday(day, state);
  const hasEntry = Object.hasOwn(state.entries, key);
  const status = weekend ? null : getStatus(day, state);
  const display = weekend ? null : !hasEntry && !holidayName ? 'blank' : status;
  const meta = display && display !== 'blank' ? STATUS_META[display] : BLANK_META;
  const today = isSameDay(day, new Date());
  const title = weekend ? 'Weekend' : display === 'blank' ? 'Undecided' : holidayName && status === 'bank' ? holidayName : meta.label;
  const ariaStatus = status && status !== 'blank' ? `${STATUS_META[status].label}, ` : '';

  const cycle = () => {
    if (holidayName) return;
    const current = hasEntry ? state.entries[key] : 'blank';
    const next = CYCLE[(CYCLE.indexOf(current as (typeof CYCLE)[number]) + 1) % CYCLE.length];
    // The toast confirms the save, so it appears once the change is stored (after the request when signed in).
    if (!state.setEntry(key, next === 'blank' ? null : next, {
      onSaved: () => showDayToast(day, next === 'blank' ? 'Cleared' : STATUS_META[next].label),
    })) return;
    track('attendance_status_changed');
  };

  return (
    <button
      type="button"
      disabled={weekend}
      data-date={key}
      title={title}
      aria-label={`${key}, ${ariaStatus}${title}${weekend ? '' : ', change attendance status'}`}
      aria-current={today ? 'date' : undefined}
      onClick={cycle}
      className={cn(
        'day-cell calendar-day relative flex flex-col text-left transition',
        weekend ? 'cursor-not-allowed bg-slate-100 text-slate-400' : `${meta.classes} hover:brightness-[.98] active:scale-[.995]`,
        today && 'ring-2 ring-inset ring-blue-500',
      )}
    >
      <span className="calendar-day-number">
        <sup className="text-[10px] font-semibold leading-none">{day.getDate()}</sup>
      </span>
      <div className="calendar-day-content w-full flex-1">
        <span className="calendar-day-emoji" aria-hidden="true">{display && display !== 'blank' ? STATUS_EMOJI[display] : ''}</span>
      </div>
    </button>
  );
}

export function Calendar() {
  const { viewDate } = useAttendance();
  const offset = (new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay() + 6) % 7;
  const total = Math.ceil((offset + daysInMonth(viewDate)) / 7) * 7;
  const cells = Array.from({ length: total }, (_, i) => {
    const dayNum = i - offset + 1;
    return dayNum < 1 || dayNum > daysInMonth(viewDate) ? null : new Date(viewDate.getFullYear(), viewDate.getMonth(), dayNum);
  });

  return (
    <section id="calendarCard" className="calendar-card overflow-hidden rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.07]">
      <div className="calendar-header border-b border-slate-200 px-4 py-4">
        <CalendarNav />
      </div>
      <div className="min-w-0 bg-white p-4">
        <div className="calendar-grid calendar-weekdays grid bg-white">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={cn('px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider', i < 5 ? 'text-slate-500' : 'text-slate-400')}>{d}</div>
          ))}
        </div>
        <div id="calendar" className="calendar-grid calendar-days grid bg-white">
          {cells.map((day, i) => day
            ? <DayCell key={iso(day)} day={day} />
            : <div key={`pad-${i}`} className="day-cell calendar-compact-cell border-none bg-transparent" />)}
        </div>
      </div>
    </section>
  );
}
