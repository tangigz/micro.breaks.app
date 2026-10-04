// npm run dev: starts WXT, which opens the test browser, then switches Chrome's Developer mode on.
// Chrome keeps unpacked extensions disabled without it, and resets the preference when it is
// written to the profile from outside, so it has to be set from Chrome's own extensions page.
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const wxt = spawn('npx', ['wxt'], { stdio: 'inherit' });
wxt.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => wxt.kill(signal));

async function enableDeveloperMode() {
  const browser = await chromium.connectOverCDP('http://localhost:9333');
  const page = await browser.contexts()[0].newPage();
  await page.goto('chrome://extensions/');
  await page.evaluate(
    () => new Promise((done) => chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true }, done)),
  );
  await page.close();
  await browser.close();
}

for (let attempt = 0; attempt < 60; attempt++) {
  await new Promise((r) => setTimeout(r, 1000));
  try {
    await enableDeveloperMode();
    console.log('✔ Developer mode is on in the test browser: new tabs open micro.breaks');
    break;
  } catch {
    // The browser is not up yet
  }
}
