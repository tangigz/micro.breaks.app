import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { defineWebExtConfig } from 'wxt';

/**
 * `npm run dev` opens the test browser: Chrome for Testing (installed by Playwright), since
 * regular Chrome no longer loads unpacked extensions from the command line. Its profile is
 * kept in .dev-profile, so settings and state survive between runs.
 */
const profile = resolve('.dev-profile');
mkdirSync(profile, { recursive: true });

export default defineWebExtConfig({
  binaries: { chrome: chromium.executablePath() },
  chromiumProfile: profile,
  keepProfileChanges: true,
});
