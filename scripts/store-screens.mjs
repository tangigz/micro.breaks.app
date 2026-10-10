// Takes plain 1280 × 800 captures of the main screens from the built extension, as raw material
// for the store screenshots, and remakes the 440 × 280 promo tile: node scripts/store-screens.mjs
// Run `npm run build` first. Captures go to test-results/store/ (not kept in git); the screenshots
// on the store, in docs/store/, are composed by hand with a caption above each screen.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const OUT = 'docs/store';
const extension = path.resolve('.output/chrome-mv3');
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
const id = new URL(worker.url()).host;
const home = await context.newPage();
await home.goto(`chrome-extension://${id}/setup.html`);
// Nothing is sent, and the machine's real idle state is ignored
await home.evaluate(() => chrome.storage.local.set({ testAnalytics: true, testIgnoreIdle: true }));
const message = (m) => home.evaluate((x) => chrome.runtime.sendMessage(x), m);
const send = (input) => message({ mb: 'dispatch', input });
const advance = (min) => message({ mb: 'dev_advance', ms: min * 60_000 });
const shot = async (page, name) => {
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `test-results/store/${name}.png` });
  console.log('✔', name);
};
const missionTab = async () => {
  await home.waitForTimeout(900);
  return context.pages().filter((p) => p.url().endsWith('/mission.html')).at(-1);
};

// A Monday morning
await home.evaluate((t) => chrome.storage.local.set({ devOffsetMs: t - Date.now() }), new Date(2030, 0, 7, 10).getTime());
await send({ type: 'setup_done' });
await send({ type: 'idle', state: 'active' });

// 1. The new tab, battery two thirds full
await advance(22);
await home.goto(`chrome-extension://${id}/newtab.html`);
await shot(home, 'screenshot-1-new-tab');

// 2. Time to move, with a walking mission
let state = await advance(38);
if (state.break.missionId !== 'walk') {
  await send({ type: 'skip_open' });
  await send({ type: 'skip_cancel' });
}
for (let i = 0; i < 30 && state.break?.missionId !== 'walk'; i++) {
  // Draw again until the mission is the walk: finish this break quietly and take the next one
  state = await send({ type: 'start_mission' });
  await send({ type: 'idle', state: 'locked' });
  state = await advance(15);
  if (state.break) state = await send({ type: 'video_done' });
  await send({ type: 'outcome_seen' });
  await send({ type: 'idle', state: 'active' });
  state = await advance(60);
}
let page = await missionTab();
await page.bringToFront();
await shot(page, 'screenshot-2-time-to-move');

// 3. The mission, part of the way through
await send({ type: 'start_mission' });
await send({ type: 'idle', state: 'locked' });
await advance(2);
await shot(page, 'screenshot-3-mission');

// 4. Recharged
await advance(3);
await page.waitForTimeout(3500);
await shot(page, 'screenshot-4-recharged');
await send({ type: 'outcome_seen' });

// 5. The skip challenge
await send({ type: 'idle', state: 'active' });
await advance(60);
for (let i = 0; i < 30; i++) {
  state = await send({ type: 'skip_open' });
  if (state.break.skip.kind === 'maths') break;
  await send({ type: 'skip_cancel' });
}
page = await missionTab();
await page.bringToFront();
await shot(page, 'screenshot-5-skip');

// The small promo tile: icon, name and line
const icon = readFileSync('public/icon/icon.svg', 'utf8');
const promo = await context.newPage();
await promo.setViewportSize({ width: 440, height: 280 });
await promo.setContent(`<body style="margin:0;width:440px;height:280px;background:#0B0B0C;display:flex;align-items:center;justify-content:center;gap:28px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden;position:relative">
  <div style="position:absolute;left:-120px;top:-110px;width:500px;height:500px;border-radius:999px;background:radial-gradient(closest-side,rgba(61,220,132,.28),rgba(61,220,132,0))"></div>
  <div style="position:relative;width:104px;height:104px;flex-shrink:0">${icon.replace('width="128" height="128"', 'width="104" height="104"')}</div>
  <div style="position:relative;display:flex;flex-direction:column;gap:8px">
    <div style="font-size:34px;font-weight:700;letter-spacing:-0.03em;color:#F5F5F7">micro<span style="color:#6FCF7A">.</span>breaks</div>
    <div style="font-size:17px;line-height:22px;font-weight:600;color:#A1A1A6;width:210px">Move a little, every hour you sit.</div>
  </div>
</body>`);
await promo.waitForTimeout(300);
await promo.screenshot({ path: `${OUT}/promo-440x280.png` });
console.log('✔ promo-440x280');

await context.close();
