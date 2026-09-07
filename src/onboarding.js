import { $, escapeHtml } from './ui.js';
import { targetControls, regionControls, bindTargetControls, readTarget, targetDescription } from './target-controls.js';
import { REGION_NAMES } from './constants.js';
import { saveSettings } from './storage.js';
import { track } from './analytics.js';
export function startOnboarding(state,onComplete) {
  let step=1;
  let draft={...state.settings};
  $('app').hidden=true; $('onboarding').hidden=false;
  function render() {
    $('onboarding').innerHTML=`<main class="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-10"><img src="/app-icon.svg" alt="" class="mb-6 h-12 w-12"><h1 class="text-3xl font-semibold tracking-tight" tabindex="-1">${step===3?'You’re all set':'Welcome to InOffice'}</h1><p class="mt-3 text-base leading-6 text-slate-600">${step===3?'A little clarity for your hybrid working week.':'Keep track of your office days and know exactly what you need to hit your hybrid-work target.'}</p><div class="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-8">${step<3?`<p class="mb-4 text-sm text-slate-500">Step ${step} of 2</p>`:''}<form id="setupForm" class="space-y-6">${step===1?`<h2 class="text-xl font-semibold tracking-tight">How much time are you expected to spend in the office?</h2>${targetControls(draft)}`:step===2?`${regionControls(draft)}<p class="text-sm leading-6 text-slate-600">Bank holidays are excluded from your working days. You can change your calendar in Settings at any time.</p>`:`<p class="text-xl font-semibold">Your target is ${escapeHtml(targetDescription(draft))}.</p><p class="text-sm text-slate-600">Bank holidays: ${REGION_NAMES[draft.region]}.</p>`}<div class="flex items-center justify-between gap-3">${step>1?'<button type="button" id="setupBack" class="btn">Back</button>':'<span></span>'}<button class="btn primary" type="submit">${step===3?'Open InOffice':step===2?'Finish setup':'Continue'}</button></div></form></div><p class="mt-6 text-center text-xs leading-5 text-slate-500">Your attendance stays in this browser. No account needed.</p>${state.settings.onboardingComplete?'<button id="cancelSetup" class="btn mx-auto mt-3">Cancel setup</button>':''}</main>`;
    const form=$('setupForm'); if(step===1) bindTargetControls(form);
    form.addEventListener('submit',e=>{
      e.preventDefault();
      if(step===1) draft=readTarget(form,draft);
      if(step===2) draft.region=form.elements.region.value;
      if(step<3) {step++;render();return;}
      draft.onboardingComplete=true;
      try { saveSettings(draft); } catch { return; }
      state.settings=draft; track('onboarding_completed'); finish();
    });
    $('setupBack')?.addEventListener('click',()=>{step--;render();});
    $('cancelSetup')?.addEventListener('click',finish);
    $('onboarding').querySelector('h1').focus();
  }
  function finish() { $('onboarding').hidden=true; $('onboarding').innerHTML=''; $('app').hidden=false; onComplete(); $('settingsBtn').focus(); }
  render();
}
