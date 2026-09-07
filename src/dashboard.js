import { $ } from './ui.js';
import { REGION_NAMES } from './constants.js';
import { calculateMonth, formatMonth } from './attendance.js';
import { forecastMonth } from './forecast.js';
function renderStats(counts, state) {
        const stats = [
          ["Weekdays", counts.weekdays, "Mon–Fri"],
          ["Bank holidays", counts.bank, "Excluded"],
          ["OOO days", counts.ooo, "Excluded"],
          ["Working days", counts.working, "Net total"],
          ["Office days", counts.office, "Recorded"],
          ["Required office days", counts.required, `${state.settings.targetPercentage}% target`],
          ["Remaining days", counts.remaining, counts.achieved ? "Complete" : "To attend"]
        ];
        $("statsGrid").innerHTML = [4, 5, 6, 0, 1, 2, 3].map(i => { const [label, value, note] = stats[i]; return `
          <div class="${i >= 4 ? "col-span-2" : "col-span-3"} min-w-0 rounded-xl border lg:col-span-1 sm:rounded-2xl ${i === 6 && !counts.achieved ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"} p-3 sm:p-4 shadow-card">
            <p class="${i >= 4 ? "min-h-8 sm:min-h-0" : ""} text-xs font-medium text-slate-500">${i === 5 ? '<span class="sm:hidden">Required days</span><span class="hidden sm:inline">Required office days</span>' : label}</p>
            <p class="mt-1 ${i >= 4 ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"} font-semibold tracking-tight">${value}</p>
            <p class="mt-1 hidden text-xs text-slate-500 sm:block">${note}</p>
          </div>`; }).join("");
      }
export function renderSummary(state) {
        const counts = calculateMonth(state.viewDate, state);
        $("monthTitle").textContent = formatMonth(state.viewDate);
        $("summaryMonth").textContent = formatMonth(state.viewDate);
        $("regionLabel").textContent = `${REGION_NAMES[state.settings.region]} · ${state.settings.targetPercentage}% office target`;
        $("progressText").textContent = `${counts.office} / ${counts.required}`;
        $("progressBar").setAttribute("aria-valuenow", String(Math.round(counts.progress)));
        $("progressBar").setAttribute("aria-valuetext", `${counts.office} of ${counts.required} required office days`);
        $("progressBar").style.width = `${counts.progress}%`;
        $("statusMessage").className = `mt-3 rounded-xl border px-3 py-3 text-sm font-medium ${
          counts.achieved ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"
        }`;
        $("statusMessage").textContent = counts.achieved
          ? "✓ Target achieved"
          : `Need ${counts.remaining} more office day${counts.remaining === 1 ? "" : "s"}`;
        $("forecastText").textContent = forecastMonth(state.viewDate, counts, state);
        renderStats(counts, state);
      }