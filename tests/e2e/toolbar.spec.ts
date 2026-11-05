import type { Page } from '@playwright/test';
import { expect, test } from './extension';

// Monday 7 January 2030
const MONDAY = [2030, 1, 7] as const;

const title = (page: Page) => page.evaluate(() => chrome.action.getTitle({}));

/** The popup, opened as a page (a test can't click the toolbar). */
async function popup(page: Page, extensionId: string): Promise<Page> {
  const p = await page.context().newPage();
  await p.setViewportSize({ width: 320, height: 600 });
  await p.goto(`chrome-extension://${extensionId}/popup.html`);
  return p;
}

test('first run: from install until the first prompt', async ({ engine, home, extensionId }) => {
  await engine.setClock(...MONDAY, 8, 30);
  await engine.send({ type: 'setup_done' });
  await expect.poll(() => title(home)).toBe('micro.breaks · First break at 10:00');
  const p = await popup(home, extensionId);
  await expect(p.getByText('You’re set.')).toBeVisible();
  await expect(p.getByText('First break at 10:00.')).toBeVisible();
  const site = home.context().waitForEvent('page');
  await p.getByRole('button', { name: 'How it works' }).click();
  expect((await site).url()).toContain('tangigz.github.io/micro.breaks.app');

  // The first prompt ends the first run
  await engine.send({ type: 'idle', state: 'active' });
  await engine.send({ type: 'start_break_now' });
  await engine.send({ type: 'cancel_break' });
  await expect.poll(() => title(home)).toBe('micro.breaks · Your day starts at 9:00');
});

test('seated: tooltip and popup follow the battery; Start a break now opens the prompt', async ({ engine, home, extensionId }) => {
  await engine.setClock(...MONDAY, 10);
  await engine.begin();
  await engine.send({ type: 'start_break_now' });
  await engine.send({ type: 'cancel_break' });
  await engine.advance(18);
  await expect.poll(() => title(home)).toBe('micro.breaks · Next break in 42 min');
  const p = await popup(home, extensionId);
  await expect(p.getByRole('timer')).toHaveText('42 min');
  await expect(p.getByText('18 min since your last active break')).toBeVisible();
  await expect(p.getByRole('button', { name: /Edit your movement timer/ })).toHaveText('Every 60 min · 9:00–18:00');
  await p.getByRole('button', { name: 'Start a break now' }).click();
  await expect.poll(async () => (await engine.send({ type: 'tick' })).break?.voluntary).toBe(true);
  await expect.poll(() => title(home)).toBe('micro.breaks · Break due, Chrome is locked');
});

test('break due: the popup leads back to the mission', async ({ engine, home, extensionId }) => {
  await engine.setClock(...MONDAY, 10);
  await engine.begin();
  await engine.advance(60);
  const p = await popup(home, extensionId);
  await expect(p.getByText('Time to move.')).toBeVisible();
  await expect(p.getByText('Chrome is locked until you move.')).toBeVisible();
  await expect(p.getByRole('button', { name: 'Go to your mission' })).toBeVisible();
});

test('Chrome was closed: the popup asks', async ({ engine, home, extensionId }) => {
  await engine.setClock(...MONDAY, 10);
  await engine.begin();
  await engine.send({ type: 'start_break_now' });
  await engine.send({ type: 'cancel_break' });
  await engine.advance(20);
  await engine.jump(40);
  await engine.send({ type: 'startup' });
  const p = await popup(home, extensionId);
  await expect(p.getByText('Did you step away?')).toBeVisible();
  await p.getByRole('button', { name: 'Yes, I moved' }).click();
  await expect.poll(async () => (await engine.send({ type: 'tick' })).outcome?.kind).toBe('gap');
});

test('lunch and done for today: no button, the schedule stays one click away', async ({ engine, home, extensionId }) => {
  await engine.setClock(...MONDAY, 12, 45);
  await engine.begin();
  await engine.send({ type: 'start_break_now' });
  await engine.send({ type: 'cancel_break' });
  await expect.poll(() => title(home)).toBe('micro.breaks · Lunch until 13:30');
  const p = await popup(home, extensionId);
  await expect(p.getByText('Until 13:30')).toBeVisible();
  await expect(p.getByRole('button', { name: 'Start a break now' })).toHaveCount(0);
  const settings = home.context().waitForEvent('page');
  await p.getByRole('button', { name: /Edit your movement timer/ }).click();
  expect((await settings).url()).toContain('/settings.html');
});
