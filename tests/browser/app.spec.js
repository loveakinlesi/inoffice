import { test, expect } from '@playwright/test';
const holidays=Object.fromEntries(['england-and-wales','scotland','northern-ireland'].map(r=>[r,{events:[{date:'2026-09-07',title:'Test bank holiday'},{date:'2026-12-25',title:'Christmas Day'}]}]));
async function setup(page,mode='percentage') {
 await page.goto('/');
 if(mode==='days') {await page.getByRole('radio',{name:'Days per week'}).check();await page.getByLabel('Office days per week',{exact:true}).selectOption('3');}
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Finish setup'}).click();
 await expect(page.getByText(mode==='days'?'Your target is 3 office days per week.':'Your target is 50% of working days.')).toBeVisible();
 await page.getByRole('button',{name:'Open InOffice',exact:true}).click();
}
test.beforeEach(async({page})=>{
 await page.clock.install({time:new Date('2026-09-07T12:00:00')});
 await page.route('https://www.gov.uk/bank-holidays.json',r=>r.fulfill({json:holidays}));
});
test('onboarding, calendar cycling, navigation, persistence, settings and overview',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await setup(page);
 await expect(page.locator('#monthTitle')).toHaveText('September 2026');
 await expect(page.locator('[data-date="2026-09-07"]')).toContainText('Test bank holiday');
 const day=page.locator('[data-date="2026-09-08"]');
 for(const label of ['Office','OOO','Bank holiday','Home']){await day.click();await expect(day.locator('.day-label').first()).toHaveText(label);}
 await page.locator('[data-date="2026-09-07"]').click();await expect(page.locator('[data-date="2026-09-07"]')).toContainText('Home');
 await expect(page.locator('[data-date="2026-09-12"]')).toBeDisabled();
 await page.getByRole('button',{name:'Previous month'}).click();await expect(page.locator('#monthTitle')).toHaveText('August 2026');
 await page.getByRole('button',{name:'Next month'}).click();await page.getByRole('button',{name:'Next month'}).click();await expect(page.locator('#monthTitle')).toHaveText('October 2026');
 await page.getByRole('button',{name:'Today',exact:true}).click();
 await page.reload();await expect(page.locator('#app')).toBeVisible();await expect(page.locator('[data-date="2026-09-07"]')).toContainText('Home');
 await page.getByRole('button',{name:'Open settings'}).click();
 await page.getByRole('radio',{name:'Days per week'}).check();await page.getByLabel('Office days per week',{exact:true}).selectOption('3');
 await page.getByRole('combobox',{name:'Which UK bank holiday calendar should we use?'}).selectOption('scotland');
 await page.getByRole('button',{name:'Save settings'}).click();await expect(page.locator('#regionLabel')).toHaveText('Scotland · 60% office target');
 await page.getByRole('button',{name:'Year overview',exact:true}).filter({visible:true}).click();await expect(page.locator('[data-overview-month]')).toHaveCount(12);
 await expect(page.locator('[data-overview-month="0"]')).toContainText('Missed');await page.locator('[data-overview-month="0"]').click();await expect(page.locator('#monthTitle')).toHaveText('January 2026');
 await page.getByRole('button',{name:'Open settings'}).click();await page.keyboard.press('Escape');await expect(page.locator('#settingsModal')).not.toBeVisible();
 expect(errors).toEqual([]);
});
test('days setup, backup roundtrip, invalid import, rerun and resets',async({page})=>{
 await setup(page,'days');await page.locator('[data-date="2026-09-08"]').click();
 await page.getByRole('button',{name:'Open settings'}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON'}).click();const file=await download;const path=await file.path();
 await page.locator('#importInput').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"entries":null}')});await expect(page.locator('#importError')).toBeVisible();
 page.on('dialog',d=>d.accept());
 await page.getByRole('button',{name:'Reset current month',exact:true}).click();await expect(page.locator('[data-date="2026-09-08"]')).toContainText('Home');
 await page.getByRole('button',{name:'Open settings'}).click();await page.locator('#importInput').setInputFiles(path);await expect(page.locator('#settingsModal')).not.toBeVisible();await expect(page.locator('[data-date="2026-09-08"]')).toContainText('Office');
 await page.getByRole('button',{name:'Open settings'}).click();await page.getByRole('button',{name:'Run setup again'}).click();await expect(page.getByRole('heading',{name:'Welcome to InOffice'})).toBeVisible();
 await page.getByRole('radio',{name:'Percentage',exact:false}).check();await page.getByLabel('Percentage of working days').fill('75');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Finish setup'}).click();await page.getByRole('button',{name:'Open InOffice',exact:true}).click();await expect(page.locator('[data-date="2026-09-08"]')).toContainText('Office');
 await page.getByRole('button',{name:'Open settings'}).click();await page.getByRole('button',{name:'Reset all InOffice data'}).click();await expect(page.getByRole('heading',{name:'Welcome to InOffice'})).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('inoffice.entries.v1'))).toBeNull();
});
test('cached holiday fallback and legacy migration',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('office-attendance.settings.v1',JSON.stringify({target:40,region:'england-and-wales'}));
  localStorage.setItem('office-attendance.entries.v1',JSON.stringify({'2026-09-08':'office'}));
  localStorage.setItem('office-attendance.holidays.v1',JSON.stringify({fetchedAt:1,data:{'england-and-wales':{'2026-09-07':'Cached holiday'}}}));
 });
 await page.route('https://www.gov.uk/bank-holidays.json',r=>r.abort());await page.goto('/');
 await expect(page.locator('#syncStatus')).toContainText('Using cached data');await expect(page.locator('[data-date="2026-09-07"]')).toContainText('Cached holiday');await expect(page.locator('[data-date="2026-09-08"]')).toContainText('Office');
});
test('desktop and mobile visual layout',async({page})=>{
 await setup(page);
 for (const width of [320, 390, 768, 1440]) {
  await page.setViewportSize({width,height:1050});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('#statsGrid').evaluate(el=>el.getBoundingClientRect().bottom < document.querySelector('#calendar').getBoundingClientRect().top)).toBe(true);
 }
 await page.setViewportSize({width:1440,height:1050});await page.screenshot({path:'test-results/dashboard-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/dashboard-mobile.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Open settings'}).click();await page.screenshot({path:'test-results/settings-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Run setup again'}).click();await page.screenshot({path:'test-results/onboarding-mobile.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('live GOV.UK loading',async({page})=>{
 await page.unroute('https://www.gov.uk/bank-holidays.json');
 await page.goto('/');
 await expect(page.locator('#syncStatus')).toContainText('UK bank holidays are up to date.',{timeout:15000});
 const cache=await page.evaluate(()=>JSON.parse(localStorage.getItem('inoffice.holidays.v1')));
 expect(Object.keys(cache.data)).toHaveLength(3);
 expect(Object.keys(cache.data.scotland).length).toBeGreaterThan(0);
});
