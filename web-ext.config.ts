import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { defineWebExtConfig } from 'wxt';

/**
 * `npm run dev` opens the test browser: Chrome for Testing (installed by Playwright), since
 * regular Chrome no longer loads unpacked extensions from the command line. Its profile is
 * kept in .dev-profile, so settings and state survive between runs.
 */
const profile = resolve('.dev-profile');
mkdirSync(join(profile, 'Default'), { recursive: true });

// Chrome keeps unpacked extensions disabled unless Developer mode is on, and the launcher
// only sets it on a brand-new profile. Set it on every start.
const preferences = join(profile, 'Default', 'Preferences');
const prefs = existsSync(preferences) ? JSON.parse(readFileSync(preferences, 'utf8')) : {};
prefs.extensions = { ...prefs.extensions, ui: { ...prefs.extensions?.ui, developer_mode: true } };
writeFileSync(preferences, JSON.stringify(prefs));

export default defineWebExtConfig({
  binaries: { chrome: chromium.executablePath() },
  chromiumProfile: profile,
  keepProfileChanges: true,
  // Lets Playwright attach to the running test browser: chromium.connectOverCDP('http://localhost:9333')
  chromiumArgs: ['--remote-debugging-port=9333'],
});
