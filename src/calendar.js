import { STATUS_META } from './constants.js';
import { $, escapeHtml } from './ui.js';
import { iso, isWeekday, isSameDay, daysInMonth, getStatus, getAutoHoliday } from './attendance.js';
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
            cells.push('<div class="day-cell bg-slate-50/60"></div>');
            continue;
          }
          const day = new Date(date.getFullYear(), date.getMonth(), dayNum);
          const weekend = !isWeekday(day);
          const status = weekend ? null : getStatus(day, state);
          const meta = status ? STATUS_META[status] : null;
          const holidayName = getAutoHoliday(day, state);
          const todayClasses = isSameDay(day, today) ? "ring-2 ring-inset ring-blue-500" : "";
          const title = weekend ? "Weekend" : holidayName && status === "bank" ? holidayName : meta.label;

          cells.push(`
            <button ${weekend ? "disabled" : ""} data-date="${iso(day)}" title="${escapeHtml(title)}" aria-label="${iso(day)}, ${status ? STATUS_META[status].label + ", " : ""}${escapeHtml(title)}${weekend ? "" : ", change attendance status"}" ${isSameDay(day, today) ? 'aria-current="date"' : ""}
              class="day-cell relative flex flex-col items-start justify-between border-0 p-2.5 text-left transition sm:p-3
              ${weekend ? "cursor-not-allowed bg-slate-100 text-slate-400" : `${meta.classes} hover:brightness-[.98] active:scale-[.995]`}
              ${todayClasses}">
              <div class="flex w-full items-start justify-between gap-2">
                <span class="grid h-7 w-7 place-items-center rounded-full text-sm font-semibold ${isSameDay(day, today) ? "bg-blue-600 text-white" : ""}">${dayNum}</span>
                ${!weekend ? `<span class="mt-1 h-2 w-2 rounded-full ${meta.dot}"></span>` : ""}
              </div>
              <div class="w-full">
                <span class="day-label hidden truncate text-xs font-semibold sm:block">${escapeHtml(title)}</span><span class="day-label block text-xs font-semibold sm:hidden">${weekend ? "Off" : status === "bank" ? "Bank hol." : meta.label}</span>
                ${weekend ? '<span class="day-label mt-0.5 block text-[10px] text-slate-400">Disabled</span>' :
                  holidayName && status === "bank" && !Object.hasOwn(state.entries, iso(day)) ? '<span class="day-label mt-0.5 block truncate text-[10px] opacity-70">Automatic</span>' :
                  Object.prototype.hasOwnProperty.call(state.entries, iso(day)) ? '<span class="day-label mt-0.5 block text-[10px] opacity-70">Manual</span>' : ""}
              </div>
            </button>`);
        }
        $("calendar").innerHTML = cells.join("");

}