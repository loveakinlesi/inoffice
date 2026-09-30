import { $ } from './ui.js';
import { calculateMonth, formatMonth } from './lib/attendance.ts';
function renderStats(counts, state) {
  const requiredPct = counts.effective ? Math.round((counts.required / counts.effective) * 100) : 0;
  const currentPct = counts.effective ? Math.round((counts.office / counts.effective) * 100) : 100;
  const card = (title, body, note, extra = '') => `
    <div class="min-w-[min(10.5rem,100%)] max-w-full flex-1 rounded-xl border border-slate-200 bg-white p-3 shadow-card sm:max-w-[15rem] sm:rounded-2xl sm:p-4 ${extra}">
      <p class="text-base font-medium text-slate-600">${title}</p>
      <p class="mt-1 text-xl font-bold tracking-tight sm:text-2xl">${body}</p>
      ${note ? `<p class="mt-1 text-xs text-slate-500">${note}</p>` : ''}
    </div>`;
  const currentCard = state.settings.attendanceMode === 'percentage'
    ? card("Current", `${currentPct}%`, 'Office days as a share of effective days')
    : '';

  $("statsGrid").innerHTML = [
    `
      <div class="min-w-full max-w-full flex-1 rounded-xl border border-slate-200 bg-white p-3 shadow-card sm:min-w-[20rem] sm:max-w-[28rem] sm:rounded-2xl sm:p-4">
        <div class="flex items-end justify-between gap-3">
          <div>
            <p class="text-xs font-medium text-slate-500">Days in Office</p>
            <p class="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">${counts.office}/${counts.required}</p>
          </div>
          <p class="text-sm font-semibold text-slate-600">${counts.progress.toFixed(0)}%</p>
        </div>
        <div class="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
          <div class="h-full rounded-full bg-emerald-500 transition-all duration-500" style="width:${counts.progress}%"></div>
        </div>
      </div>
    `,
    currentCard,
    card(
      "Required",
      `${counts.required}`,
      state.settings.attendanceMode === 'percentage'
        ? `${state.settings.targetPercentage}% of effective days${counts.effective ? ` (${requiredPct}%)` : ''}`
        : `${state.settings.targetDaysPerWeek} office days per week`,
    ),
    card("Working days", `${counts.working}`, 'Weekdays minus bank holidays'),
    card("Leave days", `${counts.ooo + counts.sick}`, 'OOO + sick days'),
    card("Bank holidays", `${counts.bank}`, 'Public holidays excluded from target')
  ].filter(Boolean).join('');
}
export function renderSummary(state) {
        const counts = calculateMonth(state.viewDate, state);
        const month = formatMonth(state.viewDate);
        const monthTitle = $("monthTitleMobile");
        const summaryMonth = $("summaryMonth");
        if (monthTitle) monthTitle.textContent = month;
        if (summaryMonth) summaryMonth.textContent = month;
        const progressBar = $("progressBar");
        if (progressBar) {
          progressBar.setAttribute("aria-valuenow", String(Math.round(counts.progress)));
          progressBar.setAttribute("aria-valuetext", `${counts.office} of ${counts.required} required office days`);
          progressBar.style.width = `${counts.progress}%`;
        }
        const statusMessage = $("statusMessage");
        if (statusMessage) {
          statusMessage.className = `mt-3 rounded-xl border px-3 py-3 text-sm font-medium ${
            counts.achieved ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"
          }`;
          statusMessage.textContent = counts.achieved
            ? "✓ Target achieved"
            : `Need ${counts.remaining} more office day${counts.remaining === 1 ? "" : "s"}`;
        }
        renderStats(counts, state);
      }
