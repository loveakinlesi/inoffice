import { defineConfig } from '@playwright/test';

// Browser tests run their own dev server on a separate port with an in-memory database and
// test-only sign-in, so they never touch real data or reuse a developer's server on :5173.
const PORT = 5174;
const URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  use: {
    baseURL: URL,
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {},
  },
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: URL,
    reuseExistingServer: false,
    env: {
      TEST_DATABASE: 'pglite',
      AUTH_TEST_UTILS: '1',
      AUTH_ALLOWED_HOSTS: `127.0.0.1:${PORT}`,
      BETTER_AUTH_SECRET: 'playwright-secret-that-is-at-least-32-characters',
      BETTER_AUTH_URL: URL,
      // Show the sign-in UI; the test sign-in route bypasses Google itself.
      GOOGLE_CLIENT_ID: 'playwright.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'playwright',
    },
  },
  reporter: 'list',
});
