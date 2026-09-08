import { $, openModal, closeModal, toast } from './ui.js';
import { targetControls, regionControls, bindTargetControls, readTarget } from './target-controls.js';
import { saveSettings, saveEntries, saveBackup, resetData } from './storage.js';
import { validateBackup, DEFAULT_SETTINGS } from './validation.js';
import { monthKey, formatMonth } from './attendance.js';
import { holidayCoverage } from './holidays.js';
import { track } from './analytics.js';
const closeSettingsModal = () => {
  const modal = $('settingsModal');
  if (modal?.open) closeModal('settingsModal');
};
export function renderSettings(state,{render,setup,refreshHolidays},{containerId='settingsContent',openAsModal=false}={}) {
  const container=$(containerId);
  if(!container)return;
  container.innerHTML=`<form id="settingsForm" class="space-y-6">${targetControls(state.settings)}${regionControls(state.settings)}<button class="btn primary w-full" type="submit">Save settings</button></form><section class="space-y-3 border-t border-slate-200 pt-5"><h3 class="font-medium">Bank holidays</h3><p id="holidaySettingsStatus" class="text-sm leading-6 text-slate-600"></p><button id="refreshHolidayBtn" class="btn text-xs">Refresh bank holidays</button></section><section class="space-y-3 border-t border-slate-200 pt-5"><h3 class="font-medium">Data</h3><p class="text-sm leading-6 text-slate-600">Attendance is saved only in this browser. Export a backup to keep a copy or move to another device. Importing replaces your current data.</p><div class="flex flex-wrap gap-2"><button id="exportBtn" class="btn">Export JSON</button><button id="importBtn" class="btn">Import JSON</button><input id="importInput" type="file" accept=".json,application/json" hidden></div><p id="importError" role="alert" class="text-sm text-red-700" hidden></p><div class="flex flex-col items-start gap-2 border-t border-slate-200 pt-4"><button id="resetMonthBtn" class="btn">Reset current month</button><p class="text-xs text-slate-500">Clears manual entries for ${formatMonth(state.viewDate)}.</p><button id="rerunSetupBtn" class="btn mt-2">Run setup again</button><p class="text-xs text-slate-500">Your attendance history will be preserved.</p><button id="resetAllBtn" class="btn danger mt-2">Reset all InOffice data</button></div></section>`;
  const form=container.querySelector('#settingsForm'); bindTargetControls(form);
  container.querySelector('#holidaySettingsStatus').textContent=state.holidayMessage+holidayCoverage(state);
  container.querySelector('#refreshHolidayBtn').addEventListener('click',async e=>{
    const button=e.currentTarget;
    button.disabled=true;button.textContent='Refreshing…';
    try {await refreshHolidays(true);} finally {button.disabled=false;button.textContent='Refresh bank holidays';}
  });
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const settings={...readTarget(form,state.settings),region:form.elements.region.value};
    try {saveSettings(settings);} catch{return;}
    state.settings=settings; closeSettingsModal(); render(); toast('Settings saved');
  });
  container.querySelector('#exportBtn').addEventListener('click',()=>{
    const payload={app:'InOffice',version:1,exportedAt:new Date().toISOString(),settings:state.settings,entries:state.entries,holidayCache:state.holidayCache};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
    const link=document.createElement('a'); link.href=url; link.download=`inoffice-backup-${new Date().toISOString().slice(0,10)}.json`; link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);track('backup_exported');toast('Backup exported');
  });
  container.querySelector('#importBtn').addEventListener('click',()=>container.querySelector('#importInput').click());
  container.querySelector('#importInput').addEventListener('change',async e=>{
    const file=e.target.files[0]; if(!file)return;
    const importError=container.querySelector('#importError');
    importError.hidden=true;
    try {
      if(file.size>5*1024*1024) throw new Error('This file is too large. Choose an InOffice JSON backup smaller than 5 MB.');
      let parsed; try {parsed=JSON.parse(await file.text());} catch {throw new Error('This file is not readable JSON. Choose a backup exported from InOffice.');}
      const data=validateBackup(parsed);
      if(!confirm('Replace all current settings and attendance with this backup? Export your current data first if you want to keep it.'))return;
      saveBackup(data); Object.assign(state,data);closeSettingsModal();render();track('backup_imported');toast('Backup imported');
      if(!state.settings.onboardingComplete)setup();
      refreshHolidays();
    } catch(error) {importError.textContent=error.message; importError.hidden=false;}
    finally {e.target.value='';}
  });
  container.querySelector('#resetMonthBtn').addEventListener('click',()=>{
    if(!confirm(`Reset all manual attendance entries for ${formatMonth(state.viewDate)}? Automatic bank holidays will remain.`))return;
    const prefix=monthKey(state.viewDate);
    const entries=Object.fromEntries(Object.entries(state.entries).filter(([date])=>!date.startsWith(prefix)));
    try {saveEntries(entries);} catch{return;}
    state.entries=entries;closeSettingsModal();render();toast('Current month reset');
  });
  container.querySelector('#rerunSetupBtn').addEventListener('click',()=>{closeSettingsModal();setup();});
  container.querySelector('#resetAllBtn').addEventListener('click',()=>{
    if(!confirm('Delete all InOffice settings, attendance history and cached bank holidays from this browser? This cannot be undone.'))return;
    try {resetData();} catch{return;}
    Object.assign(state,{settings:{...DEFAULT_SETTINGS},entries:{},holidayCache:{fetchedAt:0,data:{}}});
    closeSettingsModal();setup();refreshHolidays();toast('All InOffice data reset');
  });
  if(openAsModal) {
    openModal('settingsModal');
    track('settings_opened');
  }
}
export function openSettings(state,handlers) {
  renderSettings(state,handlers,{containerId:'settingsContent',openAsModal:true});
}
