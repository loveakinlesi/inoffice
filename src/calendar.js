import { STATUS_META } from './lib/constants.ts';
import { $, escapeHtml } from './ui.js';
import { iso, isWeekday, isSameDay, daysInMonth, getStatus, getAutoHoliday } from './lib/attendance.ts';

const STATUS_EMOJI = {
  home: '🏠',
  office: '🏢',
  ooo: '🌴',
  sick: '🤒',
  bank: '🎉'
};

export function renderCalendar(state) {
        const date = state.viewDate;
        const first = new Date(date.getFullYear(), date.getMonth(), 1);
        const mondayOffset = (first.getDay() + 6) % 7;
        const totalCells = Math.ceil((mondayOffset + daysInMonth(date)) / 7) * 7;
        const today = new Date();
        const cells = [];

        for (let i = 0; i < totalCells; i++) {
          const dayNum = i - mondayOffset + 1;
          if (dayNum < 1 || dayNum > daysInMonth(date)) {
            cells.push(`<div class="day-cell calendar-compact-cell bg-transparent border-none"></div>`);
            continue;
          }
          const day = new Date(date.getFullYear(), date.getMonth(), dayNum);
          const weekend = !isWeekday(day);
          const hasEntry = Object.hasOwn(state.entries, iso(day));
          const status = weekend ? null : getStatus(day, state);
          const holidayName = getAutoHoliday(day, state);
          const displayStatus = weekend ? null : (!hasEntry && !holidayName ? 'blank' : status);
          const meta = displayStatus && displayStatus !== 'blank' ? STATUS_META[displayStatus] : { label: 'Blank', classes: 'bg-white text-slate-500 border-slate-200', dot: 'bg-slate-300' };
          const todayClasses = isSameDay(day, today) ? "ring-2 ring-inset ring-blue-500" : "";
          const title = weekend ? "Weekend" : displayStatus === 'blank' ? 'Undecided' : holidayName && status === "bank" ? holidayName : meta.label;
          const mobileEmoji = displayStatus && displayStatus !== 'blank' ? STATUS_EMOJI[displayStatus] : '';

          const ariaStatus = status && status !== 'blank' ? `${STATUS_META[status].label}, ` : '';
          cells.push(`
            <button ${weekend ? "disabled" : ""} data-date="${iso(day)}" title="${escapeHtml(title)}" aria-label="${iso(day)}, ${ariaStatus}${escapeHtml(title)}${weekend ? "" : ", change attendance status"}" ${isSameDay(day, today) ? 'aria-current="date"' : ""}
              class="day-cell calendar-day relative flex flex-col text-left transition
              ${weekend ? "cursor-not-allowed bg-slate-100 text-slate-400" : `${meta.classes} hover:brightness-[.98] active:scale-[.995]`}
              ${todayClasses}">
              <span class="calendar-day-number">
                <sup class="text-[10px] font-semibold leading-none">${dayNum}</sup>
              </span>
              <div class="calendar-day-content w-full flex-1">
                <span class="calendar-day-emoji" aria-hidden="true">${mobileEmoji}</span>
              </div>
            </button>`);
        }
        $("calendar").innerHTML = cells.join("");

}
