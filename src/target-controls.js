import { REGION_NAMES } from './lib/constants.ts';
import { track } from './lib/analytics.ts';
export const targetDescription = s => s.attendanceMode==='days' ? `${s.targetDaysPerWeek} office day${s.targetDaysPerWeek===1?'':'s'} per week` : `${s.targetPercentage}% of working days`;
export function targetControls(settings) {
  return `<fieldset class="space-y-3"><legend class="mb-3 font-medium">Attendance target</legend><div class="grid gap-3 sm:grid-cols-2">${[['percentage','Percentage','I need to be in the office for a percentage of my working days.'],['days','Days per week','I need to be in the office a certain number of days each week.']].map(([v,title,copy])=>`<label class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 has-[:checked]:border-slate-950 has-[:checked]:bg-slate-50"><input class="mt-1 h-4 w-4 shrink-0" type="radio" name="attendanceMode" value="${v}" ${settings.attendanceMode===v?'checked':''}><span><span class="block text-sm font-semibold">${title}</span><span class="mt-1 block text-sm leading-5 text-slate-600">${copy}</span></span></label>`).join('')}</div><div data-percentage ${settings.attendanceMode==='percentage'?'':'hidden'}><label for="targetPercentage" class="mb-2 block text-sm font-medium">Percentage of working days</label><input id="targetPercentage" name="targetPercentage" class="field" type="number" min="5" max="100" step="5" value="${settings.targetPercentage}" required><p class="mt-2 text-xs text-slate-500">Between 5% and 100%. For example, 50% of working days.</p></div><div data-days ${settings.attendanceMode==='days'?'':'hidden'}><label for="targetDaysPerWeek" class="mb-2 block text-sm font-medium">Office days per week</label><select id="targetDaysPerWeek" name="targetDaysPerWeek" class="field">${Array.from({length:9},(_,i)=>1+i/2).map(n=>`<option value="${n}" ${n===(settings.targetDaysPerWeek||2.5)?'selected':''}>${n} day${n===1?'':'s'}</option>`).join('')}</select><p class="mt-2 text-xs text-slate-500">Converted to a percentage of a five-day week for monthly calculations.</p></div></fieldset>`;
}
export const regionControls = s => `<label class="block"><span class="mb-3 block font-medium">Which UK bank holiday calendar should we use?</span><select name="region" class="field">${Object.entries(REGION_NAMES).map(([v,n])=>`<option value="${v}" ${s.region===v?'selected':''}>${n}</option>`).join('')}</select></label>`;
export function bindTargetControls(form) {
  const update=()=>{
    const days=form.elements.attendanceMode.value==='days';
    form.querySelector('[data-percentage]').hidden=days; form.querySelector('[data-days]').hidden=!days;
    form.elements.targetPercentage.disabled=days;
  };
  form.addEventListener('change',e=>{ if(e.target.name==='attendanceMode') {update();track('target_mode_selected');} });
  update();
}
export function readTarget(form,previous) {
  const mode=form.elements.attendanceMode.value;
  const days=mode==='days'?Number(form.elements.targetDaysPerWeek.value):null;
  return {...previous,attendanceMode:mode,targetDaysPerWeek:days,targetPercentage:days===null?Number(form.elements.targetPercentage.value):days/5*100};
}
