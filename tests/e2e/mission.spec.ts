import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './extension';

const missionPage = async (context: BrowserContext): Promise<Page> => {
  await expect.poll(() => context.pages().some((p) => p.url().endsWith('/mission.html'))).toBe(true);
  // Drawing a mission opens and cancels breaks: let earlier mission tabs finish leaving, then take the live one
  await new Promise((r) => setTimeout(r, 600));
  return context.pages().filter((p) => p.url().endsWith('/mission.html')).at(-1)!;
};

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/mission/${name}.png` });

test('mission: the ring counts down only while away, then "Recharged."', async ({ context, engine, home }) => {
  await engine.setClock(2030, 1, 7, 10);
  await engine.begin();
  // Draw until the mission is not a video one
  let state = await engine.send({ type: 'start_break_now' });
  while (['stretch', 'boost'].includes(state.break!.missionId)) {
    await engine.send({ type: 'cancel_break' });
    state = await engine.send({ type: 'start_break_now' });
  }
  const page = await missionPage(context);
  await page.getByRole('button', { name: 'Start mission' }).click();

  // Nothing has run yet: the screen asks to leave
  await expect(page.getByRole('timer')).toHaveText('5:00');
  await expect(page.getByText('Time left')).toBeVisible();
  await expect(page.getByText('of 5 min')).toBeVisible();
  await expect(page.getByText('Leave the computer.')).toBeVisible();
  await shot(page, 'running');

  // Two minutes away, then back: paused
  await engine.send({ type: 'idle', state: 'locked' });
  await engine.advance(2);
  await engine.send({ type: 'idle', state: 'active' });
  await expect(page.getByRole('timer')).toHaveText('3:00');
  await expect(page.getByRole('timer')).toHaveAttribute('aria-label', '3 minutes 0 seconds left, paused');
  await expect(page.getByText('Paused')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Step away to continue. You touched the keyboard or mouse.');
  await page.waitForTimeout(1100);
  await shot(page, 'paused');

  // Away for the rest
  await engine.send({ type: 'idle', state: 'locked' });
  await engine.advance(3);
  await expect(page.getByRole('heading', { name: 'Recharged.' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Battery recharged to 100 percent' })).toBeVisible();
  await page.waitForTimeout(4200);
  await shot(page, 'recharged');

  // Back to work closes the mission tab and leaves the user on what they had
  await page.getByRole('button', { name: 'Back to work' }).click();
  await expect.poll(() => context.pages().some((p) => p.url().endsWith('/mission.html'))).toBe(false);
  expect((await engine.send({ type: 'tick' })).outcome).toBeNull();
  await home.reload();
  await expect(home.getByText('Next break in')).toBeVisible();
});

test('video mission: plays the trimmed video on the clock, then asks to confirm', async ({ context, engine }) => {
  await engine.setClock(2030, 1, 7, 10);
  await engine.begin();
  // Draw until the energy boost mission: its first video is trimmed to 0:40–2:50
  let state = await engine.send({ type: 'start_break_now' });
  while (state.break!.missionId !== 'boost') {
    await engine.send({ type: 'cancel_break' });
    state = await engine.send({ type: 'start_break_now' });
  }
  const page = await missionPage(context);
  await page.getByRole('button', { name: 'Start mission' }).click();

  await expect(page.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/BCUzHzpJLAI\?.*start=40&end=170/);
  await expect(page.getByText('Follow along.')).toBeVisible();
  await expect(page.getByText(/video \d of/)).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveAttribute('src', /controls=0/);
  await expect(page.getByRole('timer')).toHaveText(/^2:(10|0\d)$/);

  // The real player, not an error page, starting at the trim point (needs the network)
  const player = page.frameLocator('iframe');
  await expect(player.locator('video')).toHaveCount(1, { timeout: 20_000 });
  await expect(player.locator('.ytp-error')).toHaveCount(0);
  await expect.poll(() => player.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 20_000 }).toBeGreaterThan(40);
  await page.waitForTimeout(1000);
  await shot(page, 'video');

  // No button before the end; touching the computer does not pause anything
  await expect(page.getByRole('button', { name: "I've done the routine" })).toHaveCount(0);
  await engine.advance(1);
  await engine.send({ type: 'idle', state: 'active' });
  await expect(page.getByRole('timer')).toHaveText(/^1:(10|0\d)$/);

  // When the video's length has passed, the countdown gives way to the button
  await engine.advance(2);
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByText('The video is over.')).toBeVisible();
  expect((await engine.send({ type: 'tick' })).break?.phase).toBe('mission');
  await shot(page, 'video-over');
  await page.getByRole('button', { name: "I've done the routine" }).click();
  await expect(page.getByRole('heading', { name: 'Recharged.' })).toBeVisible();
});

test('new tab: a recharge earned while away plays once', async ({ engine, home }) => {
  await engine.setClock(2030, 1, 7, 10);
  await engine.begin();
  await engine.advance(20);
  await engine.send({ type: 'idle', state: 'idle', idleForMs: 5 * 60_000 });
  await engine.advance(5);
  await engine.send({ type: 'idle', state: 'active' });

  await expect(home.getByText('While you were away')).toBeVisible();
  await expect(home.getByRole('heading', { name: 'Recharged.' })).toBeVisible();
  await home.getByRole('button', { name: 'Back to work' }).click();
  await expect(home.getByText('Next break in')).toBeVisible();
  await expect(home.getByText('0 min since your last active break')).toBeVisible();
  await home.reload();
  await expect(home.getByText('Next break in')).toBeVisible();
});

test('Chrome was closed: "Yes, I moved" recharges', async ({ engine, home }) => {
  await engine.setClock(2030, 1, 7, 10);
  await engine.begin();
  await engine.advance(12);
  await engine.jump(40);
  await engine.send({ type: 'startup' });
  await home.getByRole('button', { name: 'Yes, I moved' }).click();
  await expect(home.getByText('Chrome was closed · You moved')).toBeVisible();
  await expect(home.getByRole('heading', { name: 'Recharged.' })).toBeVisible();
});
