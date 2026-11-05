import type { BrowserContext, Page, Worker } from '@playwright/test';
import { SENTENCES } from '../../src/engine/challenge';
import { batteryRgb } from '../../src/ui/battery-color';
import { expect, test } from './extension';

/**
 * The live toolbar icon, checked on its pixels: every setIcon and setBadgeText call made by the
 * service worker is recorded, so the tests read the icon Chrome would show.
 */

// Monday 7 January 2030
const MONDAY = [2030, 1, 7] as const;

type Rgb = [number, number, number];
interface Recorded {
  setIcon: { t: number; charge: Rgb; glow: Rgb }[];
  badge: number;
}

async function worker(context: BrowserContext): Promise<Worker> {
  return context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
}

/** Wraps chrome.action.setIcon and the badge calls. Pixels are read from the 32 px image. */
async function record(context: BrowserContext): Promise<void> {
  await (await worker(context)).evaluate(() => {
    const g = globalThis as unknown as { __rec?: Recorded; chrome: typeof chrome };
    if (g.__rec) return;
    const rec: Recorded = { setIcon: [], badge: 0 };
    g.__rec = rec;
    const action = g.chrome.action as unknown as Record<string, (...a: unknown[]) => unknown>;
    const pixel = (img: ImageData, x: number, y: number): Rgb => {
      const i = (y * img.width + x) * 4;
      return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!];
    };
    const setIcon = action.setIcon!.bind(action);
    action.setIcon = (details: unknown, ...rest: unknown[]) => {
      const img = (details as { imageData: Record<string, ImageData> }).imageData['32']!;
      // Bottom of the charge, inside the outline; and the glow, beside the battery
      rec.setIcon.push({ t: Date.now(), charge: pixel(img, 16, 24), glow: pixel(img, 7, 18) });
      return setIcon(details, ...rest);
    };
    for (const name of ['setBadgeText', 'setBadgeBackgroundColor']) {
      const original = action[name]!.bind(action);
      action[name] = (...a: unknown[]) => {
        rec.badge++;
        return original(...a);
      };
    }
  });
}

const recorded = async (context: BrowserContext) =>
  (await worker(context)).evaluate(() => (globalThis as unknown as { __rec: Recorded }).__rec);

const title = (page: Page) => page.evaluate(() => chrome.action.getTitle({}));

const near = (a: Rgb, b: Rgb, tolerance: number) => a.every((v, i) => Math.abs(v - b[i]!) <= tolerance);

/** "41:58" → seconds. */
const seconds = (clock: string) => {
  const [m, s] = clock.split(':').map(Number);
  return m! * 60 + s!;
};

/** The new tab battery's fill colour, "rgb(r, g, b)" → [r, g, b]. */
async function newTabRgb(page: Page): Promise<Rgb> {
  const color = await page
    .getByRole('img', { name: /^Battery at/ })
    .locator('div')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  return color.match(/\d+/g)!.slice(0, 3).map(Number) as Rgb;
}

/** Past the first run: a break prompt has opened once. */
async function pastFirstRun(engine: { send: (i: never) => Promise<unknown> }) {
  await engine.send({ type: 'start_break_now' } as never);
  await engine.send({ type: 'cancel_break' } as never);
}

test('the icon, the tooltip and the popup stay in sync with the new tab battery over an interval', async ({
  context,
  engine,
  home,
  extensionId,
}) => {
  await engine.setClock(...MONDAY, 10);
  await record(context);
  await engine.begin();
  await pastFirstRun(engine);
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 320, height: 600 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  for (const minute of [0, 15, 30, 45]) {
    if (minute) await engine.advance(15);
    const left = 60 - minute;
    // Tooltip
    await expect.poll(() => title(home)).toBe(`micro.breaks · Next break in ${left} min`);
    // Popup countdown = new tab countdown, to the second
    await expect(popup.getByRole('timer')).toHaveText(new RegExp(`^${left - 1}:\\d\\d|${left}:00$`));
    const [a, b] = [await popup.getByRole('timer').textContent(), await home.getByRole('timer').textContent()];
    expect(Math.abs(seconds(a!) - seconds(b!))).toBeLessThanOrEqual(1);
    // Icon colour = new tab battery colour = the colour of this level
    const level = 100 - (minute / 60) * 100;
    await expect.poll(async () => (await recorded(context)).setIcon.at(-1)?.charge).toBeTruthy();
    const icon = (await recorded(context)).setIcon.at(-1)!.charge;
    // The new tab fades its battery colour over 1 s: wait for the fade to end
    await expect.poll(async () => near(await newTabRgb(home), batteryRgb(level), 3), { message: `new tab at ${minute} min` }).toBe(true);
    expect(near(icon, batteryRgb(level), 14), `icon at ${minute} min: ${icon} vs ${batteryRgb(level)}`).toBe(true);
  }
  expect((await recorded(context)).badge).toBe(0);
});

test('the icon pulses smoothly in the last 5 minutes, stops when the prompt opens, never a badge', async ({
  context,
  engine,
  home,
}) => {
  await engine.setClock(...MONDAY, 10);
  await record(context);
  await engine.begin();
  await pastFirstRun(engine);

  // Not pulsing: at most one redraw a minute
  await engine.advance(50);
  let before = (await recorded(context)).setIcon.length;
  await home.waitForTimeout(1000);
  expect((await recorded(context)).setIcon.length - before).toBeLessThanOrEqual(1);

  // Last 5 minutes: about 15 frames a second, the glow rising and falling
  await engine.advance(6);
  await expect.poll(() => title(home)).toBe('micro.breaks · Next break in 4 min');
  before = (await recorded(context)).setIcon.length;
  await home.waitForTimeout(2000);
  const frames = (await recorded(context)).setIcon.slice(before);
  expect(frames.length).toBeGreaterThanOrEqual(20);
  const glow = frames.map((f) => f.glow[0]);
  expect(Math.max(...glow) - Math.min(...glow), 'the glow changes over a breath').toBeGreaterThan(8);
  // Smooth: no jump between two frames bigger than a fraction of the whole swing
  const steps = glow.slice(1).map((g, i) => Math.abs(g - glow[i]!));
  expect(Math.max(...steps)).toBeLessThanOrEqual((Math.max(...glow) - Math.min(...glow)) / 2);

  // The prompt opens: the pulse stops, the icon shows an empty battery
  await engine.advance(4);
  await expect.poll(() => title(home)).toBe('micro.breaks · Break due, Chrome is locked');
  await home.waitForTimeout(300);
  before = (await recorded(context)).setIcon.length;
  await home.waitForTimeout(1000);
  expect((await recorded(context)).setIcon.length - before).toBeLessThanOrEqual(1);
  expect((await recorded(context)).badge).toBe(0);
});

test('off hours draw a grey battery; lunch a green one', async ({ context, engine, home }) => {
  await engine.setClock(...MONDAY, 12, 45);
  await record(context);
  await engine.begin();
  await pastFirstRun(engine);
  await expect.poll(() => title(home)).toBe('micro.breaks · Lunch until 13:30');
  await expect.poll(async () => (await recorded(context)).setIcon.at(-1)?.charge).toBeTruthy();
  expect(near((await recorded(context)).setIcon.at(-1)!.charge, batteryRgb(100), 14)).toBe(true);

  // Evening, without going through the afternoon's breaks
  await engine.jump(6 * 60);
  await engine.send({ type: 'tick' });
  await expect.poll(() => title(home)).toBe('micro.breaks · Done for today');
  const grey = (await recorded(context)).setIcon.at(-1)!.charge;
  expect(near(grey, [142, 142, 147], 14), `grey: ${grey}`).toBe(true);
});

test('meetings: in a meeting, then a break waiting for it', async ({ context, engine, home, extensionId }) => {
  const at = (h: number, m = 0) => new Date(2030, 0, 7, h, m).getTime();
  await engine.setClock(...MONDAY, 10);
  await engine.begin();
  await pastFirstRun(engine);
  await home.evaluate((b) => chrome.storage.local.set({ testCalendar: b }), [[at(10, 20), at(11, 30)]]);
  await home.goto(home.url().replace('newtab.html', 'settings.html'));
  await home.getByRole('button', { name: 'Connect Google Calendar' }).click();
  await expect(home.getByText('Connected', { exact: true })).toBeVisible();

  await engine.advance(25);
  await expect.poll(() => title(home)).toBe('micro.breaks · In a meeting until 11:30');
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByText('In a meeting')).toBeVisible();
  await expect(popup.getByText('Until 11:30')).toBeVisible();

  await engine.advance(40);
  await expect.poll(() => title(home)).toBe('micro.breaks · Break waiting for your meeting, until 11:30');
  await expect(popup.getByText('Break due at 11:00')).toBeVisible();
  await expect(popup.getByText('Your break is waiting. It opens when the meeting ends.')).toBeVisible();
});

test('skipped: an empty battery and the next break', async ({ engine, home, extensionId, context }) => {
  await engine.setClock(...MONDAY, 10);
  await engine.begin();
  await engine.advance(60);
  // Pass the skip challenge, whichever it is
  let state = await engine.send({ type: 'skip_open' });
  for (let i = 0; state.break?.skip && i < 20; i++) {
    const c = state.break.skip;
    state =
      c.kind === 'maths'
        ? await engine.send({ type: 'skip_answer', value: c.answer })
        : await engine.send({ type: 'skip_sentence', text: SENTENCES[c.sentences[c.done]!]! });
  }
  expect(state.break).toBeNull();
  await expect.poll(() => title(home)).toMatch(/^micro\.breaks · Break skipped, next break in (59|60) min$/);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByText('Skipped · Next break in')).toBeVisible();
  await expect(popup.getByRole('img', { name: 'Battery empty' })).toBeVisible();
});

test('mission running: paused while you are at the computer, or a video playing', async ({ engine, home, extensionId, context }) => {
  await engine.setClock(...MONDAY, 10);
  await engine.begin();
  await engine.advance(60);
  const state = await engine.send({ type: 'start_mission' });
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  if (state.break?.videoIndex != null) {
    // A video mission runs on its own clock, at the computer
    await expect(popup.getByText('Your routine is playing.')).toBeVisible();
    await expect.poll(() => title(home)).toMatch(/^micro\.breaks · Mission, \d+:\d\d left$/);
  } else {
    await expect(popup.getByText('Mission · Paused')).toBeVisible();
    await expect(popup.getByText('Step away to continue.')).toBeVisible();
    await expect.poll(() => title(home)).toMatch(/^micro\.breaks · Mission paused, \d+:\d\d left$/);
  }
  // Go to your mission brings the mission tab back
  await popup.getByRole('button', { name: 'Go to your mission' }).click();
  await expect.poll(() => context.pages().some((p) => p.url().endsWith('/mission.html'))).toBe(true);
});

test('right-click menu: the three items exist, and their targets open', async ({ context, home }) => {
  // The items are created on install; a duplicate id proves each one is there
  const ids = await home.evaluate(() =>
    Promise.all(
      ['start', 'settings', 'how'].map(
        (id) =>
          new Promise<string>((resolve) =>
            chrome.contextMenus.create({ id, title: id, contexts: ['action'] }, () => resolve(chrome.runtime.lastError?.message ?? 'missing')),
          ),
      ),
    ),
  );
  for (const message of ids) expect(message).toContain('duplicate id');

  // A click on an item runs the same targets as the popup
  const open = (target: string) => home.evaluate((t) => chrome.runtime.sendMessage({ mb: 'open', target: t }), target);
  let page = context.waitForEvent('page');
  await open('settings');
  expect((await page).url()).toContain('/settings.html');
  page = context.waitForEvent('page');
  await open('how');
  expect((await page).url()).toContain('tangigz.github.io/micro.breaks.app');
});
