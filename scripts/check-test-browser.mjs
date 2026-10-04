// Reports what the running test browser (npm run dev) shows on a new tab: node scripts/check-test-browser.mjs
import { chromium } from '@playwright/test';

const browser = await chromium.connectOverCDP('http://localhost:9333');
const context = browser.contexts()[0];
const page = await context.newPage();
await page.goto('chrome://extensions/');
const config = await page.evaluate(() => new Promise((r) => chrome.developerPrivate.getProfileConfiguration(r)));
const items = await page.evaluate(() => new Promise((r) => chrome.developerPrivate.getExtensionsInfo({}, r)));
console.log('developer mode:', config.inDeveloperMode);
console.log('extensions:', items.map((i) => `${i.name} ${i.state}`).join(', '));
await page.close();

// What Cmd+T does
const cdp = await browser.newBrowserCDPSession();
const { targetId } = await cdp.send('Target.createTarget', { url: 'chrome://newtab/' });
await new Promise((r) => setTimeout(r, 2500));
const tab = context.pages().find((p) => p.url().endsWith('/newtab.html'));
console.log('new tab shows:', tab ? (await tab.locator('body').innerText()).split('\n').slice(0, 3).join(' | ') : 'not micro.breaks');
await cdp.send('Target.closeTarget', { targetId });
await browser.close();
