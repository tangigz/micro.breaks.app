import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './extension';

const missionPage = async (context: BrowserContext): Promise<Page> => {
  await expect.poll(() => context.pages().some((p) => p.url().endsWith('/mission.html'))).toBe(true);
  return context.pages().find((p) => p.url().endsWith('/mission.html'))!;
};

/** The URL of the tab Chrome is showing. */
const activeTab = (home: Page) =>
  home.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.url ?? '');

test('break prompt: one mission, switch once, Enter starts it', async ({ context, engine, home }) => {
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

  // Switch swaps the mission once per break
  await page.getByRole('button', { name: 'Switch mission' }).click();
  await expect(page.getByRole('button', { name: 'Switched. One switch per break.' })).toBeDisabled();
  await expect(card.locator('div.text-\\[44px\\]')).not.toHaveText(first);
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
