import { defineConfig } from '@playwright/test';

/** Loads the built extension in Chromium. Run `npm run build` first (`npm run e2e` does). */
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  reporter: 'list',
});
