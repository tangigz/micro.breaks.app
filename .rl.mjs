import { chromium } from '@playwright/test';
import { utimesSync } from 'node:fs';
const b = await chromium.connectOverCDP('http://localhost:9333');
const ctx = b.contexts()[0];
const id = new URL(ctx.serviceWorkers()[0].url()).host;
const list = () => ctx.pages().map(p => p.url().replace(/chrome-extension:\/\/[a-z]+\//, '')).filter(u => !u.startsWith('about')).join(', ');
let page = await ctx.newPage();
await page.goto(`chrome-extension://${id}/newtab.html`);
const send = (input) => page.evaluate((m) => chrome.runtime.sendMessage(m), { mb: 'dispatch', input });
await page.evaluate(() => chrome.storage.local.set({ testIgnoreIdle: true }));
await send({ type: 'cancel_break' }); await send({ type: 'skip_cancel' });
let s = await send({ type: 'tick' });
console.log('start state: setupDone', s.setupDone, 'break', s.break?.phase ?? null);
if (!s.break) await send({ type: 'start_break_now' });
await page.waitForTimeout(2000);
console.log('locked:', list());
for (let i = 1; i <= 3; i++) {
  const now = new Date(); utimesSync('src/background/tabs.ts', now, now);
  await new Promise(r => setTimeout(r, 6000));
  console.log(`after dev reload ${i}:`, list());
}
await b.close();
