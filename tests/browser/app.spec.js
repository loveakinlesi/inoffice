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
 await page.locator('[data-date="2026-09-07"]').click({force:true});await expect(page.locator('[data-date="2026-09-07"]')).toHaveAttribute('title','Test bank holiday');
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
 await expect(page.locator('#overviewGridPage summary').first()).toContainText('Nothing logged');await page.locator('#overviewGridPage summary').first().click();await page.locator('#overviewGridPage [data-overview-month="0"]').click();await expect(page).toHaveURL(/\/$/);await expect(page.locator('#monthTitleMobile')).toHaveText('January 2026');
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

test('toasts never block the page or cover the mobile tab bar',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('inoffice.settings.v1',JSON.stringify({attendanceMode:'percentage',targetPercentage:50,targetDaysPerWeek:null,region:'england-and-wales',onboardingComplete:true}));});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('[data-date="2026-09-08"]').click();
 const toast=page.locator('[data-slot="toast"]').first();
 await expect(toast).toBeVisible();
 // Let the slide-in animation settle before measuring.
 await expect.poll(async()=>{const a=await toast.boundingBox();await page.waitForTimeout(100);const b=await toast.boundingBox();return a.y===b.y;}).toBe(true);
 // Sits above the tab bar rather than over it.
 const [t,bar]=await Promise.all([toast.boundingBox(),page.locator('.ios-tabbar').boundingBox()]);
 expect(t.y+t.height).toBeLessThanOrEqual(bar.y);
 // Whatever is underneath stays clickable while the toast is showing (no waiting for it to fade).
 const point={x:t.x+t.width/2,y:t.y+t.height/2};
 const under=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('[data-slot="toast"]')?'toast':'page',point);
 expect(under).toBe('page');
 // Repeated clicks on one day update a single toast instead of stacking.
 const day=page.locator('[data-date="2026-09-08"]');
 await day.click();await day.click();
 await expect(page.locator('[data-slot="toast"]')).toHaveCount(1);
 await expect(toast).toContainText('Tue 8 Sept: OOO');
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/settings');
 await page.getByRole('button',{name:'Export JSON'}).click();
 await expect(page.getByText('Backup exported')).toBeVisible();
 await page.getByRole('button',{name:'Delete',exact:true}).click({timeout:1000});
 await expect(page.getByRole('alertdialog')).toBeVisible();
});

test('status picker, undo and keyboard navigation in the calendar',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('inoffice.settings.v1',JSON.stringify({attendanceMode:'percentage',targetPercentage:50,targetDaysPerWeek:null,region:'england-and-wales',onboardingComplete:true}));});
 await page.goto('/');
 const day=page.locator('[data-date="2026-09-08"]');
 // Right-click picks a status directly.
 await day.click({button:'right'});
 await page.getByRole('menuitem',{name:'Sick'}).click();
 await expect(day).toHaveAttribute('title','Sick');
 // Undo in the toast restores the previous status.
 await page.locator('[data-slot="toast"]').getByRole('button',{name:'Undo'}).click();
 await expect(day).toHaveAttribute('title','Undecided');
 // Bank holidays are announced as such and not offered as changeable.
 await expect(page.locator('[data-date="2026-09-07"]')).toHaveAttribute('aria-disabled','true');
 // The grid is one tab stop; arrow keys move between weekdays, skipping weekends.
 await day.focus();
 await page.keyboard.press('ArrowRight');await expect(page.locator('[data-date="2026-09-09"]')).toBeFocused();
 await page.keyboard.press('ArrowDown');await expect(page.locator('[data-date="2026-09-16"]')).toBeFocused();
 await page.locator('[data-date="2026-09-11"]').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('[data-date="2026-09-14"]')).toBeFocused();
 await page.keyboard.press('Enter');await expect(page.locator('[data-date="2026-09-14"]')).toHaveAttribute('title','Office');
 expect(await page.locator('#calendar [data-date][tabindex="0"]').count()).toBe(1);
});

test('an empty month offers to log today and catch up on earlier days, once',async({page})=>{
 await page.clock.install({time:new Date('2026-09-09T12:00:00')});
 await page.addInitScript(()=>{localStorage.setItem('inoffice.settings.v1',JSON.stringify({attendanceMode:'percentage',targetPercentage:50,targetDaysPerWeek:null,region:'england-and-wales',onboardingComplete:true}));});
 await page.goto('/');
 const card=page.getByRole('region',{name:'Let’s get this month started'});
 await expect(card).toBeVisible();
 // Bank holidays aren't offered as catch-up days.
 await expect(card.getByRole('button',{name:'Mon 7'})).toHaveCount(0);
 await card.getByRole('button',{name:'In the office'}).click();
 await expect(page.locator('[data-date="2026-09-09"]')).toHaveAttribute('title','Office');
 await card.getByRole('button',{name:'Tue 8'}).click();
 await expect(page.locator('[data-date="2026-09-08"]')).toHaveAttribute('title','Office');
 await expect(card).toContainText('1 office day added.');
 await card.getByRole('button',{name:'Done'}).click();
 await expect(card).toHaveCount(0);
 await page.reload();
 await expect(page.getByRole('region',{name:'Let’s get this month started'})).toHaveCount(0);
});

test('planned office days count toward the plan but never read as done',async({page})=>{
 const plan=Object.fromEntries(['08','09','10','11','14','15','16','17','18','21','22'].map(d=>[`2026-09-${d}`,'office']));
 await page.addInitScript(plan=>{localStorage.setItem('inoffice.settings.v1',JSON.stringify({attendanceMode:'percentage',targetPercentage:50,targetDaysPerWeek:null,region:'england-and-wales',onboardingComplete:true}));localStorage.setItem('inoffice.entries.v1',JSON.stringify(plan));localStorage.setItem('inoffice.firststeps.v1','2026-09');},plan);
 await page.goto('/');
 await expect(page.locator('#statusMessage')).toHaveText('You’re on plan');
 await expect(page.getByRole('progressbar',{name:'Office days progress'})).toHaveAttribute('aria-valuetext','0 done and 11 planned of 11 required office days');
 await expect(page.locator('[data-date="2026-09-08"]')).toHaveClass(/calendar-day-planned/);
 await expect(page.locator('[data-date="2026-09-08"]')).toHaveAttribute('aria-label','Tuesday 8 September, Planned: Office');
 await page.getByRole('link',{name:'Year overview',exact:true}).filter({visible:true}).click();
 await expect(page.locator('#overviewGridPage [data-overview-month="8"]')).toContainText('On plan');await expect(page.locator('#overviewGridPage [data-overview-month="8"]')).toContainText('0/11');await expect(page.locator('#overviewGridPage [data-overview-month="8"]')).toContainText('+11 planned');
});

test('gaps in a past month are not verdicts, and can be filled in',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('inoffice.settings.v1',JSON.stringify({attendanceMode:'percentage',targetPercentage:50,targetDaysPerWeek:null,region:'england-and-wales',onboardingComplete:true}));localStorage.setItem('inoffice.entries.v1',JSON.stringify({'2026-08-03':'office','2026-08-04':'office'}));localStorage.setItem('inoffice.catchup.v1',JSON.stringify(['2026-09']));});
 await page.goto('/');
 await page.getByRole('button',{name:'Previous month'}).click();
 await expect(page.locator('#statusMessage')).toHaveText(/weekdays not logged/);
 await expect(page.locator('[data-date="2026-08-05"]')).toHaveClass(/calendar-day-unlogged/);
 const card=page.getByRole('region',{name:/Fill in the gaps in August/});
 await card.getByRole('button',{name:'Wed 5'}).click();
 await expect(page.locator('[data-date="2026-08-05"]')).toHaveAttribute('title','Office');
 await card.getByRole('button',{name:'The rest were home days'}).click();
 await expect(page.locator('[data-date="2026-08-06"]')).toHaveAttribute('title','Home');
 await expect(page.locator('#statusMessage')).not.toHaveText(/not logged/);
 await page.getByRole('link',{name:'Year overview',exact:true}).filter({visible:true}).click();
 await expect(page.locator('#overviewGridPage [data-overview-month="7"]')).not.toContainText('not logged');
});

test('plan your usual days fills a month in one go, with one undo',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('inoffice.settings.v1',JSON.stringify({attendanceMode:'percentage',targetPercentage:50,targetDaysPerWeek:null,region:'england-and-wales',onboardingComplete:true}));});
 await page.goto('/');
 await page.getByRole('button',{name:'Next month'}).click();
 const card=page.getByRole('region',{name:'Plan your usual days'});
 for(const d of ['Tue','Wed','Thu']) await card.getByRole('button',{name:d}).click();
 await card.getByRole('button',{name:/Plan \d+ office days/}).click();
 await expect(page.locator('[data-date="2026-10-06"]')).toHaveAttribute('title','Office');
 await expect(page.locator('[data-date="2026-10-05"]')).toHaveAttribute('title','Undecided');
 await expect(page.locator('[data-date="2026-10-06"]')).toHaveClass(/calendar-day-planned/);
 const toast=page.locator('[data-slot="toast"]').filter({hasText:'Planned'});
 await expect(toast).toContainText('office days in October');
 await toast.getByRole('button',{name:'Undo'}).click();
 await expect(page.locator('[data-date="2026-10-06"]')).toHaveAttribute('title','Undecided');
 // A single day's toast says it was a plan and what it did to the month.
 await page.locator('[data-date="2026-10-07"]').click();
 await expect(page.locator('[data-slot="toast"]').filter({hasText:'Wed 7 Oct'})).toContainText(/Planned Wed 7 Oct: Office · \d+ more to plan/);
});
