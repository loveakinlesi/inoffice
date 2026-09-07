import { $ } from './ui.js';
import { calculateMonth } from './attendance.js';
export function renderOverview(state) {
        const year = state.viewDate.getFullYear();
        $("overviewTitle").textContent = `${year} overview`;
        $("overviewGrid").innerHTML = Array.from({ length: 12 }, (_, month) => {
          const date = new Date(year, month, 1);
          const c = calculateMonth(date, state);
          const status = !c.working ? "No working days" : c.achieved ? "Achieved" : new Date(year, month + 1, 1) <= new Date() ? "Missed" : "In progress";
          const label = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(date);
          return `
            <button data-overview-month="${month}" class="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:shadow-md">
              <div class="flex items-center justify-between gap-3">
                <span class="font-semibold">${label}</span>
                <span class="rounded-full px-2 py-1 text-[11px] font-semibold ${c.achieved ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}">${status}</span>
              </div>
              <div class="mt-4 grid grid-cols-3 gap-2 text-center">
                <div><p class="text-lg font-semibold">${c.office}</p><p class="text-[10px] uppercase tracking-wide text-slate-500">Office</p></div>
                <div><p class="text-lg font-semibold">${c.required}</p><p class="text-[10px] uppercase tracking-wide text-slate-500">Required</p></div>
                <div><p class="text-lg font-semibold">${c.working}</p><p class="text-[10px] uppercase tracking-wide text-slate-500">Working</p></div>
              </div>
              <div class="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full ${c.achieved ? "bg-emerald-500" : "bg-slate-400"}" style="width:${c.progress}%"></div></div>
            </button>`;
        }).join("");

}