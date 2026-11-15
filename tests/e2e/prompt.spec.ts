import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './extension';

const missionPage = async (context: BrowserContext): Promise<Page> => {
  await expect.poll(() => context.pages().some((p) => p.url().endsWith('/mission.html'))).toBe(true);
  return context.pages().find((p) => p.url().endsWith('/mission.html'))!;
};

/**
 * The micro.breaks page Chrome is showing, or '' for anything else. The extension has no "tabs"
 * permission, so tab URLs are hidden from it: its own pages are found through runtime.getContexts.
 */
const activeTab = (home: Page) =>
  home.evaluate(async () => {
    const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['TAB'] });
    return contexts.find((c) => c.tabId === active?.id)?.documentUrl ?? '';
  });

test('break prompt: one mission, switch as often as wanted, Enter starts it', async ({ context, engine, home }) => {
  await engine.setClock(2030, 1, 7, 10);
  await engine.begin();
  const state = await engine.advance(60);
  const page = await missionPage(context);

  await expect(page.getByRole('heading', { name: 'Time to move.' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Chrome is locked until you move.');
  const card = page.getByRole('region', { name: 'Your mission' });
  const first = await card.locator('div.text-\\[44px\\]').innerText();
  expect(first.length).toBeGreaterThan(3);
  await expect(page.getByRole('button', { name: "Skip (it'll cost you)" })).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/prompt/prompt.png' });

  // Switch swaps the mission, as often as wanted
  await page.getByRole('button', { name: 'Switch mission' }).click();
  await expect(card.locator('div.text-\\[44px\\]')).not.toHaveText(first);
  const second = await card.locator('div.text-\\[44px\\]').innerText();
  await page.getByRole('button', { name: 'Switch mission' }).click();
  await expect(card.locator('div.text-\\[44px\\]')).not.toHaveText(second);
  await expect(page.getByRole('button', { name: 'Switch mission' })).toBeEnabled();
  await page.screenshot({ path: 'test-results/prompt/switched.png' });

  await page.keyboard.press('Enter');
  await expect.poll(async () => (await engine.send({ type: 'tick' })).break?.phase).toBe('mission');
  expect(state.break?.voluntary).toBe(false);
});

test('lock: switching tab or opening one is sent back to the mission tab', async ({ context, engine, home }) => {
  await engine.setClock(2030, 1, 7, 10);
  await engine.begin();
  await engine.advance(60);
  const page = await missionPage(context);
  await expect.poll(() => activeTab(home)).toMatch(/mission\.html$/);

  // Switching to another tab
  await home.bringToFront();
  await expect.poll(() => activeTab(home)).toMatch(/mission\.html$/);

  // Opening a new tab
  const other = await context.newPage();
  await other.goto('about:blank');
  await expect.poll(() => activeTab(home)).toMatch(/mission\.html$/);

  // Closing the mission tab reopens it
  await page.close();
  await expect.poll(() => activeTab(home)).toMatch(/mission\.html$/);

  // Once the mission is done, Chrome is free again
  await engine.send({ type: 'start_mission' });
  await engine.send({ type: 'idle', state: 'locked' });
  // Long enough for any mission. A video one ends with its button.
  if ((await engine.advance(15)).break) await engine.send({ type: 'video_done' });
  await home.bringToFront();
  await home.waitForTimeout(600);
  expect(await activeTab(home)).toMatch(/newtab\.html$/);
});

test('"Start a break now" opens the prompt with a free way out', async ({ context, engine, home }) => {
  await engine.setClock(2030, 1, 7, 10);
  await engine.begin();
  await home.getByRole('button', { name: 'Start a break now' }).click();
  const page = await missionPage(context);
  // One mission tab, even though the prompt and the lock both ask for it at once
  await page.waitForTimeout(800);
  expect(context.pages().filter((p) => p.url().endsWith('/mission.html'))).toHaveLength(1);
  await expect(page.getByRole('button', { name: "Skip (it'll cost you)" })).toHaveCount(0);
  await page.getByRole('button', { name: 'Not now' }).click();
  await expect(page).toHaveURL(/newtab\.html$/);
  expect((await engine.send({ type: 'tick' })).break).toBeNull();
});

test('snooze: once per break, Chrome is free for 5 min, then the prompt comes back without it', async ({ context, engine, home }) => {
  await engine.setClock(2030, 1, 7, 10);
  await engine.begin();
  await engine.advance(60);
  const page = await missionPage(context);
  await page.getByRole('button', { name: 'Snooze 5 min' }).click();

  // The break tab gives way to the new tab, with the snooze's countdown; Chrome is free
  await expect(page).toHaveURL(/newtab\.html$/);
  await expect(page.getByText('Snoozed')).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText(/^[45]:\d\d$/);
  await page.screenshot({ path: 'test-results/prompt/snoozed.png' });
  await home.bringToFront();
  await home.waitForTimeout(600);
  expect(await activeTab(home)).not.toMatch(/mission\.html$/);
  expect(await home.evaluate(() => chrome.action.getTitle({}))).toMatch(/^micro\.breaks · Break snoozed, back in [45] min$/);

  // 5 min later the prompt is back, locked, with no second snooze
  await engine.advance(5);
  const again = await missionPage(context);
  await expect(again.getByRole('heading', { name: 'Time to move.' })).toBeVisible();
  await expect.poll(() => activeTab(home)).toMatch(/mission\.html$/);
  await expect(again.getByRole('button', { name: "Skip (it'll cost you)" })).toBeVisible();
  await expect(again.getByRole('button', { name: 'Snooze 5 min' })).toHaveCount(0);
});

test('snooze: not offered on a break started with "Start a break now"', async ({ context, engine }) => {
  await engine.setClock(2030, 1, 7, 10);
  await engine.begin();
  await engine.send({ type: 'start_break_now' });
  const page = await missionPage(context);
  await expect(page.getByRole('button', { name: 'Not now' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Snooze 5 min' })).toHaveCount(0);
});
