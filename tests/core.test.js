import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMonth, getStatus } from '../src/attendance.js';
import { forecast } from '../src/forecast.js';
import { fetchHolidays, normalizeHolidays } from '../src/holidays.js';
import { DEFAULT_SETTINGS, validateBackup } from '../src/validation.js';
const makeState=()=>({settings:{...DEFAULT_SETTINGS},entries:{},holidayCache:{fetchedAt:0,data:{'england-and-wales':{'2026-09-07':'Test holiday'}}}});
test('weekday calculations, exclusion, rounding and manual overrides',()=>{
 const s=makeState(); s.entries={'2026-09-08':'office','2026-09-09':'ooo','2026-09-12':'office'};
 let c=calculateMonth(new Date(2026,8,1),s);
 assert.equal(c.weekdays,22);assert.equal(c.office,1);assert.equal(c.ooo,1);assert.equal(c.blank,19);assert.equal(c.working,21);assert.equal(c.effective,20);assert.equal(c.required,10);assert.equal(c.remaining,9);
 s.entries['2026-09-10']='sick'; c=calculateMonth(new Date(2026,8,1),s);assert.equal(c.sick,1);assert.equal(c.blank,18);assert.equal(c.effective,19);assert.equal(c.required,10);
 s.entries['2026-09-07']='home'; c=calculateMonth(new Date(2026,8,1),s);assert.equal(c.bank,1);assert.equal(c.working,21);assert.equal(c.effective,19);assert.equal(c.required,10);
 assert.equal(getStatus(new Date(2026,8,7),s),'bank');
 s.settings.targetPercentage=60;assert.equal(calculateMonth(new Date(2026,8,1),s).required,12);
});
test('forecast excludes past dates, weekends, OOO, holidays and already counted office days',()=>{
 const s=makeState();s.entries={'2026-09-08':'office','2026-09-09':'ooo'};
 const c=calculateMonth(new Date(2026,8,1),s);
 assert.equal(forecast(new Date(2026,8,1),c,s,new Date(2026,9,1)).eligible,0);
 assert.equal(forecast(new Date(2026,8,1),c,s,new Date(2026,8,28)).eligible,3);
 assert.equal(forecast(new Date(2026,8,1),c,s,new Date(2026,8,7)).eligible,15);
});
test('zero working days and leap years',()=>{
 const s=makeState();s.entries=Object.fromEntries(Array.from({length:29},(_,i)=>[`2024-02-${String(i+1).padStart(2,'0')}`,'ooo']));
 const c=calculateMonth(new Date(2024,1,1),s);assert.equal(c.weekdays,21);assert.equal(c.working,21);assert.equal(c.effective,0);assert.equal(c.required,0);assert.equal(c.progress,100);
});
test('holiday normalization, fresh cache and failed fetch fallback',async()=>{
 const json=Object.fromEntries(['england-and-wales','scotland','northern-ireland'].map(r=>[r,{events:[{date:'2026-12-25',title:'Christmas Day'}]}]));
 const cache=normalizeHolidays(json);let called=false;
 assert.equal((await fetchHolidays(cache,{fetcher:()=>{called=true;throw Error();}})).cache,cache);assert.equal(called,false);
 const fallback=await fetchHolidays(cache,{force:true,fetcher:async()=>{throw Error();}});assert.equal(fallback.cache,cache);assert.match(fallback.message,/cached/);
 const result=await fetchHolidays({fetchedAt:0,data:{}},{fetcher:async()=>({ok:true,json:async()=>json})});assert.equal(result.cache.data.scotland['2026-12-25'],'Christmas Day');
});
test('backup validation rejects invalid dates, statuses, modes, and mismatched targets',()=>{
 const s=makeState();const backup={app:'InOffice',version:1,exportedAt:new Date().toISOString(),...s};assert.doesNotThrow(()=>validateBackup(backup));
 for(const entries of [null,[],{'2026-02-30':'office'},{'2026-09-07':'<script>'}])assert.throws(()=>validateBackup({...backup,entries}));
 assert.throws(()=>validateBackup({...backup,settings:{...s.settings,targetPercentage:101}}));
 assert.throws(()=>validateBackup({...backup,settings:{...s.settings,attendanceMode:'days',targetDaysPerWeek:3,targetPercentage:50}}));
 assert.doesNotThrow(()=>validateBackup({...backup,settings:{...s.settings,attendanceMode:'days',targetDaysPerWeek:3,targetPercentage:60}}));
});
test('LocalStorage abstraction migrates legacy and rolls back failed imports',async()=>{
 const values=new Map();let failKey=null;
 globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(k===failKey)throw Error('Quota');values.set(k,v);},removeItem:k=>values.delete(k)};
 const store=await import('../src/storage.js');
 values.set('office-attendance.settings.v1',JSON.stringify({target:60,region:'scotland'}));values.set('office-attendance.entries.v1',JSON.stringify({'2026-09-07':'office'}));
 store.migrateLegacy();assert.equal(store.loadSettings().onboardingComplete,true);assert.equal(store.loadSettings().targetPercentage,60);assert.equal(store.loadEntries()['2026-09-07'],'office');
 const old=store.loadEntries();failKey=store.KEYS.holidays;
 assert.throws(()=>store.saveBackup({settings:{...DEFAULT_SETTINGS},entries:{},holidayCache:{fetchedAt:0,data:{}}}));assert.deepEqual(store.loadEntries(),old);
 failKey=null;values.set('unrelated','keep');store.resetData();assert.equal(values.get('unrelated'),'keep');assert.equal(store.loadSettings().onboardingComplete,false);
});
