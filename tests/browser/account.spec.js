import { test, expect } from '@playwright/test';

const holidays = Object.fromEntries(['england-and-wales', 'scotland', 'northern-ireland'].map(r => [r, { events: [{ date: '2026-12-25', title: 'Christmas Day' }] }]));
let counter = 0;
const uniqueEmail = () => `user${Date.now()}-${counter++}@example.test`;

async function prepare(page) {
  await page.clock.install({ time: new Date('2026-09-07T12:00:00') });
  await page.route('https://www.gov.uk/bank-holidays.json', r => r.fulfill({ json: holidays }));
}

/** Signs in through the test-only route (no Google), sharing cookies with the page. */
async function signIn(page, email) {
  const response = await page.request.post('/api/test/sign-in', { data: { email }, headers: { origin: new URL(page.url() === 'about:blank' ? 'http://127.0.0.1:5174' : page.url()).origin } });
  expect(response.ok()).toBe(true);
}

async function completeSetup(page) {
  await expect(page.getByRole('heading', { name: 'Welcome to InOffice' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Finish setup' }).click();
  await page.getByRole('button', { name: 'Open InOffice', exact: true }).click();
}

test('signed-in data syncs through the account, not this browser', async ({ page, browser }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await prepare(page);
  const email = uniqueEmail();
  await signIn(page, email);
  await page.goto('/');
  await completeSetup(page);

  const day = page.locator('[data-date="2026-09-08"]');
  await day.click();
  await expect(day).toHaveAttribute('title', 'Office');
  // Wait for the background save before reloading.
  await expect.poll(async () => (await (await page.request.get('/api/data')).json()).entries['2026-09-08']).toBe('office');
  await page.reload();
  await expect(page.locator('[data-date="2026-09-08"]')).toHaveAttribute('title', 'Office');
  expect(await page.evaluate(() => localStorage.getItem('inoffice.entries.v1'))).toBeNull();

  // Another device signed into the same account sees the same data.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await prepare(otherPage);
  await signIn(otherPage, email);
  await otherPage.goto('/');
  await expect(otherPage.locator('[data-date="2026-09-08"]')).toHaveAttribute('title', 'Office');
  await other.close();

  // The account menu shows who is signed in.
  await page.getByRole('button', { name: 'Account menu' }).click();
  await expect(page.getByText(email)).toBeVisible();
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('offline while signed in blocks edits and says so', async ({ page, context }) => {
  await prepare(page);
  await signIn(page, uniqueEmail());
  await page.goto('/');
  await completeSetup(page);

  await context.setOffline(true);
  await expect(page.getByText('You’re offline', { exact: true })).toBeVisible();
  const day = page.locator('[data-date="2026-09-09"]');
  await day.click();
  await expect(page.getByText('You’re offline. Changes can’t be saved until you reconnect.')).toBeVisible();
  await expect(day).toHaveAttribute('title', 'Undecided');

  await context.setOffline(false);
  await expect(page.getByText('You’re offline', { exact: true })).toBeHidden();
  await day.click();
  await expect(day).toHaveAttribute('title', 'Office');
});

test('signing out returns to this browser’s guest data', async ({ page }) => {
  await prepare(page);
  // Guest data recorded before signing in stays in the browser and is untouched by the account.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('inoffice.settings.v1', JSON.stringify({ attendanceMode: 'percentage', targetPercentage: 50, targetDaysPerWeek: null, region: 'england-and-wales', onboardingComplete: true }));
    localStorage.setItem('inoffice.entries.v1', JSON.stringify({ '2026-09-10': 'ooo' }));
  });
  await page.goto('/');
  await expect(page.locator('[data-date="2026-09-10"]')).toHaveAttribute('title', 'OOO');

  await signIn(page, uniqueEmail());
  await page.reload();
  await page.getByRole('button', { name: 'Not now' }).click();
  await completeSetup(page);
  await expect(page.locator('[data-date="2026-09-10"]')).toHaveAttribute('title', 'Undecided');

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(page.locator('[data-date="2026-09-10"]')).toHaveAttribute('title', 'OOO');
});

test('first sign-in offers to import this browser’s data, once', async ({ page }) => {
  await prepare(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('inoffice.settings.v1', JSON.stringify({ attendanceMode: 'days', targetPercentage: 60, targetDaysPerWeek: 3, region: 'scotland', onboardingComplete: true }));
    localStorage.setItem('inoffice.entries.v1', JSON.stringify({ '2026-09-10': 'ooo', '2026-09-11': 'office' }));
  });
  await page.goto('/');
  await signIn(page, uniqueEmail());
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Sync this device to your account?' })).toBeVisible();
  await page.getByRole('button', { name: 'Sync 2 recorded days' }).click();
  await expect(page.getByText('Synced 2 recorded days to your account')).toBeVisible();
  await expect(page.locator('[data-date="2026-09-10"]')).toHaveAttribute('title', 'OOO');
  await expect(page.locator('[data-date="2026-09-11"]')).toHaveAttribute('title', 'Office');

  const data = await (await page.request.get('/api/data')).json();
  expect(data.settings).toMatchObject({ attendanceMode: 'days', targetDaysPerWeek: 3, region: 'scotland' });
  expect(data.entries).toEqual({ '2026-09-10': 'ooo', '2026-09-11': 'office' });

  // Already answered for this account on this device: no prompt after a reload.
  await page.reload();
  await expect(page.locator('[data-date="2026-09-10"]')).toHaveAttribute('title', 'OOO');
  await expect(page.getByRole('heading', { name: 'Sync this device to your account?' })).toBeHidden();
  // The guest copy is kept.
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('inoffice.entries.v1')))).toEqual({ '2026-09-10': 'ooo', '2026-09-11': 'office' });
});

test('“Not now” can be synced later from Settings', async ({ page }) => {
  await prepare(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('inoffice.settings.v1', JSON.stringify({ attendanceMode: 'percentage', targetPercentage: 50, targetDaysPerWeek: null, region: 'england-and-wales', onboardingComplete: true }));
    localStorage.setItem('inoffice.entries.v1', JSON.stringify({ '2026-09-14': 'office' }));
  });
  await page.goto('/');
  await signIn(page, uniqueEmail());
  await page.reload();
  await page.getByRole('button', { name: 'Not now' }).click();
  await completeSetup(page);
  await expect(page.locator('[data-date="2026-09-14"]')).toHaveAttribute('title', 'Undecided');

  await page.getByRole('link', { name: 'Open settings' }).click();
  await expect(page.getByText('This device has 1 recorded day from before you signed in.')).toBeVisible();
  await page.getByRole('button', { name: 'Sync to account' }).click();
  await expect(page.getByText('Synced 1 recorded day to your account')).toBeVisible();
  // Everything is now in the account, so the offer disappears.
  await expect(page.getByRole('button', { name: 'Sync to account' })).toBeHidden();
  await page.getByRole('link', { name: /InOffice/ }).click();
  await expect(page.locator('[data-date="2026-09-14"]')).toHaveAttribute('title', 'Office');
});
