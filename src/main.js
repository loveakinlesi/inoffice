import './styles.css';
import { $, toast, bindModals, openModal, closeModal } from './ui.js';
import { createState } from './state.js';
import { renderCalendar } from './calendar.js';
import { renderSummary } from './dashboard.js';
import { renderOverview } from './overview.js';
import { openSettings } from './settings.js';
import { startOnboarding } from './onboarding.js';
import { fetchHolidays, holidayCoverage } from './holidays.js';
import { saveEntries, saveHolidayCache } from './storage.js';
import { getStatus, isWeekday } from './attendance.js';
import { STATUS_ORDER, STATUS_META } from './constants.js';
import { initAnalytics, track } from './analytics.js';
window.addEventListener('storage-error',e=>{ $('storageError').textContent=e.detail; $('storageError').hidden=false; });
const state=createState();
function render() {
  renderCalendar(state);renderSummary(state);
  $('syncStatus').textContent=state.holidayMessage+holidayCoverage(state);
  if($('overviewModal').open)renderOverview(state);
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
$('settingsBtn').addEventListener('click',()=>openSettings(state,{render,setup,refreshHolidays}));
for(const id of ['overviewBtn','overviewBtnMobile']) $(id).addEventListener('click',()=>{renderOverview(state);openModal('overviewModal');track('year_overview_opened');});
function changeMonth(offset) {
  state.viewDate=new Date(state.viewDate.getFullYear(),state.viewDate.getMonth()+offset,1);render();track('month_changed');
}
$('prevMonth').addEventListener('click',()=>changeMonth(-1));
$('nextMonth').addEventListener('click',()=>changeMonth(1));
$('todayBtn').addEventListener('click',()=>{const now=new Date();state.viewDate=new Date(now.getFullYear(),now.getMonth(),1);render();track('month_changed');});
$('calendar').addEventListener('click',e=>{
  const button=e.target.closest('[data-date]');if(!button||button.disabled)return;
  const date=new Date(`${button.dataset.date}T12:00:00`);if(!isWeekday(date))return;
  const status=STATUS_ORDER[(STATUS_ORDER.indexOf(getStatus(date,state))+1)%STATUS_ORDER.length];
  const entries={...state.entries,[button.dataset.date]:status};
  try {saveEntries(entries);}catch{return;}
  state.entries=entries;render();
  $('calendar').querySelector(`[data-date="${button.dataset.date}"]`)?.focus({preventScroll:true});
  toast(`${button.dataset.date}: ${STATUS_META[status].label}`);track('attendance_status_changed');
});
$('overviewGrid').addEventListener('click',e=>{
  const month=e.target.closest('[data-overview-month]');if(!month)return;
  state.viewDate=new Date(state.viewDate.getFullYear(),Number(month.dataset.overviewMonth),1);closeModal('overviewModal');render();track('month_changed');
});
const retry=document.createElement('button');retry.type='button';retry.className='btn text-xs';retry.textContent='Refresh bank holidays';
retry.addEventListener('click',async()=>{retry.disabled=true;retry.textContent='Refreshing…';try {await refreshHolidays(true);} finally {retry.disabled=false;retry.textContent='Refresh bank holidays';}});
$('syncStatus').after(retry);
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
