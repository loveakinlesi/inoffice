import { test, expect } from '@playwright/test';
const holidays=Object.fromEntries(['england-and-wales','scotland','northern-ireland'].map(r=>[r,{events:[{date:'2026-09-07',title:'Test bank holiday'},{date:'2026-12-25',title:'Christmas Day'}]}]));
async function setup(page,mode='percentage') {
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Welcome to InOffice'})).toBeVisible();
 await page.getByRole('link',{name:'Continue as guest'}).click();
 await expect(page).toHaveURL(/\/onboarding$/);
 await page.getByLabel('First name').fill('Alex');
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Welcome to InOffice, Alex'})).toBeVisible();
 if(mode==='days') {await page.getByRole('radio',{name:'Days per week'}).check();await page.getByLabel('Office days per week',{exact:true}).selectOption('3');}
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Finish setup'}).click();
 await expect(page.getByText(mode==='days'?'3 office days per week':'50% of working days',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Open InOffice',exact:true}).click();
}
test.beforeEach(async({page})=>{
 await page.clock.install({time:new Date('2026-09-07T12:00:00')});
 await page.route('https://www.gov.uk/bank-holidays.json',r=>r.fulfill({json:holidays}));
});
test('onboarding, calendar cycling, navigation, persistence, settings and overview',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await setup(page);
 await expect(page.locator('#monthTitleMobile')).toHaveText('September 2026');
 await expect(page.locator('[data-date="2026-09-07"]')).toHaveAttribute('title','Test bank holiday');
 const day=page.locator('[data-date="2026-09-08"]');
 for(const label of ['Office','Home','OOO','Sick','Undecided']){await day.click();await expect(day).toHaveAttribute('title',label);}
 await page.locator('[data-date="2026-09-07"]').click();await expect(page.locator('[data-date="2026-09-07"]')).toHaveAttribute('title','Test bank holiday');
 await expect(page.locator('[data-date="2026-09-12"]')).toBeDisabled();
 await page.getByRole('button',{name:'Previous month'}).click();await expect(page.locator('#monthTitleMobile')).toHaveText('August 2026');
 await page.getByRole('button',{name:'Next month'}).click();await page.getByRole('button',{name:'Next month'}).click();await expect(page.locator('#monthTitleMobile')).toHaveText('October 2026');
 await page.getByRole('button',{name:'Today',exact:true}).click();
 await page.reload();await expect(page.locator('#app')).toBeVisible();await expect(page.locator('[data-date="2026-09-08"]')).toHaveAttribute('title','Undecided');
 await page.getByRole('link',{name:'Open settings'}).click();
 await expect(page).toHaveURL(/\/settings$/);
 await expect(page.locator('#targetSummary')).toHaveText('50% of working days');
 await page.getByRole('button',{name:'Edit attendance settings'}).click();
 await page.getByRole('radio',{name:'Days per week'}).check();await page.getByLabel('Office days per week',{exact:true}).selectOption('3');
 await page.getByRole('combobox',{name:'Which UK bank holiday calendar should we use?'}).selectOption('scotland');
 await page.getByRole('button',{name:'Save settings'}).click();
 // Saving collapses the section back to its summary.
 await expect(page.locator('#regionSummary')).toHaveText('Scotland');await expect(page.locator('#targetSummary')).toHaveText('3 office days per week');
 await expect(page.locator('#settingsForm')).toHaveCount(0);
 // Cancel discards edits.
 await page.getByRole('button',{name:'Edit attendance settings'}).click();
 await page.getByRole('combobox',{name:'Which UK bank holiday calendar should we use?'}).selectOption('northern-ireland');
 await page.getByRole('button',{name:'Cancel'}).click();await expect(page.locator('#regionSummary')).toHaveText('Scotland');
 await page.getByRole('link',{name:'Year overview',exact:true}).filter({visible:true}).click();await expect(page).toHaveURL(/\/overview$/);await expect(page.locator('#overviewGridPage [data-overview-month]')).toHaveCount(12);
 await expect(page.locator('#overviewGridPage [data-overview-month="0"]')).toContainText('Missed');await page.locator('#overviewGridPage [data-overview-month="0"]').click();await expect(page).toHaveURL(/\/$/);await expect(page.locator('#monthTitleMobile')).toHaveText('January 2026');
 await page.getByRole('link',{name:'Open settings'}).click();await page.keyboard.press('Escape');await expect(page.locator('#settingsPage')).toBeVisible();
 expect(errors).toEqual([]);
});
test('days setup, backup roundtrip, invalid import, rerun and resets',async({page})=>{
 await setup(page,'days');await page.locator('[data-date="2026-09-08"]').click();
 await page.getByRole('link',{name:'Open settings'}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON'}).click();const file=await download;const path=await file.path();
 await page.locator('#settingsContentPage #importInput').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"entries":null}')});await expect(page.locator('#settingsContentPage #importError')).toBeVisible();
 const confirm=name=>page.getByRole('alertdialog').getByRole('button',{name}).click();
 await page.getByRole('button',{name:'Clear',exact:true}).click();await confirm('Clear month');await expect(page.locator('[data-date="2026-09-08"]')).toHaveAttribute('title','Undecided');
 await page.getByRole('link',{name:'Open settings'}).click();await page.locator('#settingsContentPage #importInput').setInputFiles(path);await confirm('Replace data');await expect(page.locator('[data-date="2026-09-08"]')).toHaveAttribute('title','Office');
 await page.getByRole('link',{name:'Open settings'}).click();await page.getByRole('button',{name:'Run setup',exact:true}).click();await expect(page.getByRole('heading',{name:'Welcome to InOffice'})).toBeVisible();
 const setupForm=page.locator('#setupForm');
 await setupForm.getByRole('radio',{name:'Percentage',exact:false}).check();await setupForm.locator('input[name="targetPercentage"]').fill('75');await setupForm.getByRole('button',{name:'Continue',exact:true}).click();await setupForm.getByRole('button',{name:'Finish setup'}).click();await page.getByRole('button',{name:'Open InOffice',exact:true}).click();await expect(page.locator('[data-date="2026-09-08"]')).toHaveAttribute('title','Office');
 await page.getByRole('link',{name:'Open settings'}).click();await page.getByRole('button',{name:'Delete',exact:true}).click();await confirm('Delete everything');await expect(page.getByRole('heading',{name:'Welcome to InOffice'})).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('inoffice.entries.v1'))).toBeNull();
});
test('cached holiday fallback and legacy migration',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('office-attendance.settings.v1',JSON.stringify({target:40,region:'england-and-wales'}));
  localStorage.setItem('office-attendance.entries.v1',JSON.stringify({'2026-09-08':'office'}));
  localStorage.setItem('office-attendance.holidays.v1',JSON.stringify({fetchedAt:1,data:{'england-and-wales':{'2026-09-07':'Cached holiday'}}}));
 });
 await page.route('https://www.gov.uk/bank-holidays.json',r=>r.abort());await page.goto('/');
 await page.getByRole('link',{name:'Open settings'}).click();await expect(page.locator('#settingsContentPage #holidaySettingsStatus')).toContainText('Using cached data');await page.getByRole('link',{name:/InOffice/}).click();await expect(page.locator('[data-date="2026-09-07"]')).toHaveAttribute('title','Cached holiday');await expect(page.locator('[data-date="2026-09-08"]')).toHaveAttribute('title','Office');
});
test('desktop and mobile visual layout',async({page})=>{
 await setup(page);
 for (const width of [320, 390, 768, 1440]) {
  await page.setViewportSize({width,height:1050});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('#calendarCard').evaluate(el=>el.getBoundingClientRect().width<=590)).toBe(true);
 }
 await page.setViewportSize({width:1440,height:1050});await page.screenshot({path:'test-results/dashboard-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/dashboard-mobile.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('link',{name:'Open settings'}).click();await page.screenshot({path:'test-results/settings-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Run setup',exact:true}).click();await page.screenshot({path:'test-results/onboarding-mobile.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('live GOV.UK loading',async({page})=>{
 await page.unroute('https://www.gov.uk/bank-holidays.json');
 await setup(page);
 await page.getByRole('link',{name:'Open settings'}).click();await expect(page.locator('#settingsContentPage #holidaySettingsStatus')).toContainText('UK bank holidays are up to date.',{timeout:15000});
 const cache=await page.evaluate(()=>JSON.parse(localStorage.getItem('inoffice.holidays.v1')));
 expect(Object.keys(cache.data)).toHaveLength(3);
 expect(Object.keys(cache.data.scotland).length).toBeGreaterThan(0);
});

test('landing offers Google or guest; setup asks a guest for their first name',async({page})=>{
 await page.goto('/settings');
 await expect(page).toHaveURL(/\/$/);
 await expect(page.getByRole('button',{name:'Continue with Google'})).toBeVisible();
 await page.getByRole('link',{name:'Continue as guest'}).click();
 await expect(page).toHaveURL(/\/onboarding$/);
 await expect(page.getByText('Step 1 of 3')).toBeVisible();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByText('Enter your first name to continue.')).toBeVisible();
 // Back from the first step returns to the landing page.
 await page.getByRole('button',{name:'Back'}).click();
 await expect(page).toHaveURL(/\/$/);
 await page.getByRole('link',{name:'Continue as guest'}).click();
 await page.getByLabel('First name').fill('  Sam  ');
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Welcome to InOffice, Sam'})).toBeVisible();
 await expect(page.getByText('Step 2 of 3')).toBeVisible();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Finish setup'}).click();
 await expect(page.getByRole('heading',{name:'You’re all set, Sam'})).toBeVisible();
 await page.getByRole('button',{name:'Open InOffice',exact:true}).click();
 expect(JSON.parse(await page.evaluate(()=>localStorage.getItem('inoffice.profile.v1')))).toEqual({firstName:'Sam'});
 // Rerunning setup doesn't ask for the name again.
 await page.goto('/onboarding');
 await expect(page.getByText('Step 1 of 2')).toBeVisible();
});
