import './styles.css';
import { $, toast, bindModals, closeModal } from './ui.js';
import { createState } from './state.js';
import { renderCalendar } from './calendar.js';
import { renderSummary } from './dashboard.js';
import { renderOverview } from './overview.js';
import { renderSettings } from './settings.js';
import { startOnboarding } from './onboarding.js';
import { initInstallPrompt } from './install.js';
import { fetchHolidays, holidayCoverage } from './holidays.js';
import { saveEntries, saveHolidayCache } from './storage.js';
import { formatMonth, isWeekday, getAutoHoliday } from './attendance.js';
import { STATUS_META } from './constants.js';
import { initAnalytics, track } from './analytics.js';
window.addEventListener('storage-error',e=>{ $('storageError').textContent=e.detail; $('storageError').hidden=false; });
const state=createState();
const refreshInstallPrompt = initInstallPrompt(state);
const routes = new Set(['/', '/settings', '/overview']);
const currentRoute = () => routes.has(window.location.pathname) ? window.location.pathname : '/';
function navigate(path) {
  if (window.location.pathname !== path) history.pushState({}, '', path);
  render();
}
const isCurrentViewMonth = () => {
  const now=new Date();
  return state.viewDate.getFullYear()===now.getFullYear() && state.viewDate.getMonth()===now.getMonth();
};
function updateMobileTodayButton() {
  const button=$('todayBtnMobile');
  if(button) button.hidden=isCurrentViewMonth();
}
function render() {
  const route=currentRoute();
  $('calendarPage').hidden=route!=='/';
  $('settingsPage').hidden=route!=='/settings';
  $('overviewPage').hidden=route!=='/overview';
  $('overviewBtn').classList.toggle('bg-slate-100', route==='/overview');
  $('settingsLink').classList.toggle('bg-slate-100', route==='/settings');
  document.querySelectorAll('[data-route-link]').forEach(link=>{
    const active=link.dataset.routeLink===route;
    link.setAttribute('aria-current', active ? 'page' : 'false');
  });
  $('monthTitleMobile').textContent=formatMonth(state.viewDate);
  renderCalendar(state);renderSummary(state);
  const holidaySettingsStatus = $('holidaySettingsStatus');
  if (holidaySettingsStatus) holidaySettingsStatus.textContent=state.holidayMessage+holidayCoverage(state);
  if(route==='/settings')renderSettings(state,{render,setup,refreshHolidays},{containerId:'settingsContentPage'});
  if(route==='/overview')renderOverview(state,{titleId:'overviewTitlePage',gridId:'overviewGridPage'});
  if($('overviewModal').open)renderOverview(state);
  updateMobileTodayButton();
  refreshInstallPrompt();
}
let holidayRequest=0;
async function refreshHolidays(force=false) {
  const request=++holidayRequest;
  const result=await fetchHolidays(state.holidayCache,{force});
  if(request!==holidayRequest)return;
  if(result.cache!==state.holidayCache) {
    try { saveHolidayCache(result.cache); state.holidayCache=result.cache; } catch { result.message='Holiday data could not be saved. Check browser storage and try again.'; }
  }
  state.holidayMessage=result.message;render();
}
const setup=()=>startOnboarding(state,render);
bindModals();
$('settingsLink').addEventListener('click',e=>{e.preventDefault();navigate('/settings');track('settings_opened');});
for(const id of ['overviewBtn','overviewBtnMobile']) {
  const button=$(id);
  if(button) button.addEventListener('click',e=>{e.preventDefault();navigate('/overview');track('year_overview_opened');});
}
function changeMonth(offset) {
  state.viewDate=new Date(state.viewDate.getFullYear(),state.viewDate.getMonth()+offset,1);render();track('month_changed');
}
$('prevMonthMobile').addEventListener('click',()=>changeMonth(-1));
$('todayBtnMobile').addEventListener('click',()=>{const now=new Date();state.viewDate=new Date(now.getFullYear(),now.getMonth(),1);render();track('month_changed');});
$('nextMonthMobile').addEventListener('click',()=>changeMonth(1));
$('calendar').addEventListener('click',e=>{
  const button=e.target.closest('[data-date]');if(!button||button.disabled)return;
  const date=new Date(`${button.dataset.date}T12:00:00`);if(!isWeekday(date))return;
  const key=button.dataset.date;
  if (getAutoHoliday(date,state)) return;
  const cycle=['blank','office','home','ooo','sick'];
  const hasEntry=Object.hasOwn(state.entries,key);
  const current=hasEntry ? state.entries[key] : 'blank';
  const next=cycle[(cycle.indexOf(current)+1)%cycle.length];
  const entries={...state.entries};
  if (next==='blank') delete entries[key]; else entries[key]=next;
  try {saveEntries(entries);}catch{return;}
  state.entries=entries;render();
  $('calendar').querySelector(`[data-date="${button.dataset.date}"]`)?.focus({preventScroll:true});
  toast(`${button.dataset.date}: ${next === 'blank' ? 'Blank' : STATUS_META[next].label}`);track('attendance_status_changed');
});
$('overviewGrid').addEventListener('click',e=>{
  const month=e.target.closest('[data-overview-month]');if(!month)return;
  state.viewDate=new Date(state.viewDate.getFullYear(),Number(month.dataset.overviewMonth),1);closeModal('overviewModal');render();track('month_changed');
});
$('overviewGridPage').addEventListener('click',e=>{
  const month=e.target.closest('[data-overview-month]');if(!month)return;
  state.viewDate=new Date(state.viewDate.getFullYear(),Number(month.dataset.overviewMonth),1);navigate('/');track('month_changed');
});
document.addEventListener('click',e=>{
  const link=e.target.closest('a[href="/"],a[href="/settings"],a[href="/overview"]');
  if(!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)return;
  e.preventDefault();navigate(new URL(link.href).pathname);
});
window.addEventListener('popstate',render);
// Reload shared local state when another tab changes it, preserving the viewed month.
window.addEventListener('storage',e=>{
  if(e.key&&!e.key.startsWith('inoffice.'))return;
  const next=createState(); Object.assign(state,{settings:next.settings,entries:next.entries,holidayCache:next.holidayCache});
  closeModal('settingsModal');
  if(!state.settings.onboardingComplete) {closeModal('overviewModal');setup();}
  else {$('onboarding').hidden=true;$('app').hidden=false;render();}
});
render();if(!state.settings.onboardingComplete)setup();
refreshHolidays();initAnalytics();
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
