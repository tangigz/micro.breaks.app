import type { Page } from '@playwright/test';
import { expect, test } from './extension';

async function shot(page: Page, name: string) {
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `test-results/setup/${name}.png` });
}

test('install opens the welcome flow, and every new tab leads to it until it is finished', async ({ context, home }) => {
  await expect(home).toHaveURL(/setup\.html$/);
  await expect(home.getByRole('heading', { name: 'Stay charged all day.' })).toBeVisible();
  expect(context.pages().filter((p) => p.url().endsWith('/setup.html')).length).toBeGreaterThanOrEqual(1);
});

test('one screen: the battery fills as the three steps are completed', async ({ engine, home }) => {
  await engine.setClock(2030, 1, 7, 10);
  await expect(home.getByText('More energy')).toBeVisible();
  // Before anything is collected: what is shared, agreement by starting, and the privacy policy
  const consent = home.getByText('We use your email only to recognise your installation and to contact you about your feedback');
  await expect(consent).toBeVisible();
  // It lines up with the field on the left and stops at the right edge of "Let's start"
  const [text, field, button] = await Promise.all([
    consent.boundingBox(),
    home.getByLabel('Your email').boundingBox(),
    home.getByRole('button', { name: "Let's start" }).boundingBox(),
  ]);
  expect(Math.round(text!.x)).toBe(Math.round(field!.x));
  expect(text!.x + text!.width).toBeLessThanOrEqual(button!.x + button!.width + 1);
  await expect(home.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', /privacy\.html$/);
  await expect(home.getByRole('button', { name: "Let's start" })).toBeDisabled();
  await home.getByLabel('Your email').fill('not an email');
  await expect(home.getByRole('button', { name: "Let's start" })).toBeDisabled();
  await shot(home, 'welcome');
  await home.getByLabel('Your email').fill('Friend@Example.com');
  await home.getByRole('button', { name: "Let's start" }).click();

  // Step 1 is open: the movement timer, editable in place
  await expect(home.getByRole('heading', { name: 'Charge your battery.' })).toBeVisible();
  await expect(home.getByRole('img', { name: 'Setup: 0 of 3 steps done' })).toBeVisible();
  await expect(home.getByRole('button', { name: 'Step 1, Set your movement timer' })).toHaveAttribute('aria-expanded', 'true');
  await expect(home.getByRole('button', { name: 'Step 2, Protect your meetings' })).toHaveAttribute('aria-expanded', 'false');
  // The meetings card belongs to step 2 now, not to the timer
  await expect(home.getByRole('region', { name: 'Meetings' })).toHaveCount(0);
  await shot(home, 'steps-0');
  // A highlighted word is changed in place, with its own arrows
  await home.getByRole('button', { name: 'Interval, 60 min' }).click();
  await home.getByRole('button', { name: 'Previous value' }).click();
  await shot(home, 'steps-0-editing');
  await expect(home.getByRole('button', { name: 'Interval, 45 min' })).toBeVisible();
  await home.getByRole('button', { name: 'Continue' }).click();
  expect((await engine.send({ type: 'tick' })).settings.intervalMin).toBe(45);

  // Step 2 opens by itself: the calendar, recommended, and skippable
  await expect(home.getByRole('img', { name: 'Setup: 1 of 3 steps done' })).toBeVisible();
  await expect(home.getByText('Every 45 min, 9:00–18:00, every day.')).toBeVisible();
  await expect(home.getByText('micro.breaks will never lock Chrome during a meeting')).toBeVisible();
  await expect(home.getByText('Read-only, busy times only: no titles, no attendees.')).toBeVisible();
  await expect(home.getByRole('button', { name: 'Connect Google Calendar' })).toBeVisible();
  await shot(home, 'steps-1');
  await home.getByRole('button', { name: 'Not now' }).click();

  // Step 3: notifications, asked through Chrome's prompt (granted in the test build), no test notification
  await expect(home.getByRole('img', { name: 'Setup: 2 of 3 steps done' })).toBeVisible();
  await expect(home.getByText('Not connected. You can connect it later from your movement timer.')).toBeVisible();
  await expect(home.getByText("Allow notifications to know 5 min before each break, even when you're working in another app.")).toBeVisible();
  await shot(home, 'steps-2');

  // A closed tab resumes where it left off
  await home.reload();
  await expect(home.getByRole('img', { name: 'Setup: 2 of 3 steps done' })).toBeVisible();
  await home.getByRole('button', { name: 'Allow' }).click();
  await expect(home.getByText('On. A heads-up 5 min before each break.')).toBeVisible();
  expect(await engine.notifications()).toEqual([]);

  // All set: full battery, same screen
  await expect(home.getByRole('heading', { name: 'All set.' })).toBeVisible();
  await expect(home.getByRole('img', { name: 'Setup: 3 of 3 steps done' })).toBeVisible();
  await shot(home, 'all-set');
  expect((await engine.send({ type: 'tick' })).setupDone).toBe(false);
  // Whatever this machine's real idle state was when the browser started, the tester is at the keyboard
  await engine.send({ type: 'idle', state: 'active' });
  await home.getByRole('button', { name: 'Start moving' }).click();

  await expect(home).toHaveURL(/newtab\.html$/);
  await expect(home.getByText('Next break in')).toBeVisible();
  const state = await engine.send({ type: 'tick' });
  expect(state.setupDone).toBe(true);
  expect(state.seatedSince).not.toBeNull();

  // What would go to PostHog: the setup funnel, under one install id, with the email attached
  const tracked = await engine.tracked();
  expect(tracked.map((e) => e.event)).toEqual([
    'extension_installed',
    'setting_changed',
    'setup_step_done',
    'setup_step_done',
    'setup_step_done',
    'setup_completed',
  ]);
  expect(new Set(tracked.map((e) => e.distinct_id)).size).toBe(1);
  expect(tracked[0]!.distinct_id).toMatch(/^[0-9a-f-]{36}$/);
  expect(tracked.at(-1)!.properties.$set).toEqual({ email: 'friend@example.com' });
  expect(tracked.filter((e) => e.event === 'setup_step_done').map((e) => [e.properties.step, e.properties.skipped ?? false])).toEqual([
    [1, false],
    [2, true],
    [3, false],
  ]);
  expect(tracked.find((e) => e.event === 'setup_completed')!.properties).toMatchObject({ intervalMin: 45, days: 'every', calendar: false });
});

test('in a small window, the steps stay on screen, at the same scale as the other screens', async ({ home }) => {
  await home.setViewportSize({ width: 1000, height: 570 });
  await home.getByLabel('Your email').fill('friend@example.com');
  await home.getByRole('button', { name: "Let's start" }).click();
  await home.getByRole('button', { name: 'End of day, 18:00' }).click();
  await expect(home.getByRole('button', { name: 'Next value' })).toBeVisible();
  // Nothing is pushed off screen
  await expect(home.getByRole('button', { name: 'Continue' })).toBeInViewport({ ratio: 1 });
  await expect(home.getByRole('button', { name: 'Step 3, Get a heads-up before each break' })).toBeInViewport({ ratio: 1 });
  await expect(home.getByRole('img', { name: 'Setup: 0 of 3 steps done' })).toBeInViewport({ ratio: 1 });
  // Not shrunk to fit: the scale only depends on the window, 570 / 720
  expect(await home.evaluate(() => Number((document.querySelector('#root > div') as HTMLElement).style.zoom))).toBeCloseTo(0.79, 2);
});

test('a done step can be reopened', async ({ home }) => {
  await home.getByLabel('Your email').fill('Friend@Example.com');
  await home.getByRole('button', { name: "Let's start" }).click();
  await home.getByRole('button', { name: 'Continue' }).click();
  await expect(home.getByRole('button', { name: 'Connect Google Calendar' })).toBeVisible();
  await home.getByRole('button', { name: 'Step 1, Set your movement timer, done' }).click();
  await expect(home.getByRole('button', { name: 'Interval, 60 min' })).toBeVisible();
  await expect(home.getByRole('button', { name: 'Connect Google Calendar' })).toHaveCount(0);
  await home.getByRole('button', { name: 'Continue' }).click();
  await expect(home.getByRole('button', { name: 'Connect Google Calendar' })).toBeVisible();
});

test('movement timer: every highlighted word is editable', async ({ engine, home }) => {
  await engine.setClock(2030, 1, 7, 10);
  await engine.begin();
  await home.getByRole('link', { name: /Edit your movement timer/ }).click();
  await expect(home).toHaveURL(/settings\.html$/);
  await expect(home.getByText('Scroll over a highlighted word, or click it, to change it.')).toBeVisible();
  await shot(home, 'timer');

  // Interval, with the word's own arrows
  await home.getByRole('button', { name: 'Interval, 60 min' }).click();
  await expect(home.getByText('Scroll, or use the arrows.')).toBeVisible();
  await shot(home, 'timer-editing');
  await home.getByRole('button', { name: 'Previous value' }).click();
  await expect(home.getByRole('button', { name: 'Interval, 45 min' })).toBeVisible();
  // At the first value the arrow stops
  await home.getByRole('button', { name: 'Previous value' }).click();
  await expect(home.getByRole('button', { name: 'Interval, 30 min' })).toBeVisible();
  await expect(home.getByRole('button', { name: 'Previous value' })).toBeDisabled();
  await home.getByRole('button', { name: 'Next value' }).click();
  // A click elsewhere puts the word back to rest
  await home.getByText('Your movement timer').click();
  await expect(home.getByRole('button', { name: 'Previous value' })).toHaveCount(0);
  await expect(home.getByRole('button', { name: 'Interval, 45 min' })).toBeVisible();

  // Start of day, with the keyboard
  await home.getByRole('button', { name: 'Start of day, 9:00' }).click();
  await home.keyboard.press('ArrowLeft');
  await home.keyboard.press('ArrowDown');
  await expect(home.getByRole('button', { name: 'Start of day, 8:30' })).toBeVisible();
  await home.keyboard.press('Enter');
  await expect(home.getByText('Scroll over a highlighted word, or click it, to change it.')).toBeVisible();

  // End of day, by scrolling over the word without clicking it
  await home.getByRole('button', { name: 'End of day, 18:00' }).hover();
  await home.mouse.wheel(0, 50);
  await expect(home.getByRole('button', { name: 'End of day, 18:15' })).toBeVisible();
  await home.mouse.wheel(0, -50);
  await expect(home.getByRole('button', { name: 'End of day, 18:00' })).toBeVisible();

  // Lunch can't end before it starts: it stops at the first value after 12:30
  await home.getByRole('button', { name: 'Lunch ends, 13:30' }).click();
  for (let i = 0; i < 10; i++) await home.keyboard.press('ArrowLeft');
  await expect(home.getByRole('button', { name: 'Lunch ends, 12:45' })).toBeVisible();
  await home.keyboard.press('Escape');

  await home.getByRole('button', { name: 'Days, every day. Switch' }).click();
  await expect(home.getByRole('button', { name: 'Days, on weekdays. Switch' })).toBeVisible();

  const { settings } = await engine.send({ type: 'tick' });
  expect(settings).toMatchObject({ intervalMin: 45, dayStart: 8 * 60 + 30, lunchEnd: 12 * 60 + 45, days: 'weekdays' });

  await home.getByRole('link', { name: 'Back' }).click();
  await expect(home).toHaveURL(/newtab\.html$/);
  await expect(home.getByText('Every 45 min · 8:30–18:00')).toBeVisible();
});

test('notifications declined: the step waits, "Not now" still finishes the welcome flow', async ({ home }) => {
  // As if the user clicked "Deny" in Chrome's prompt
  await home.evaluate(() => chrome.storage.local.set({ testNotificationsDeclined: true }));
  await home.reload();
  await home.getByLabel('Your email').fill('declined@example.com');
  await home.getByRole('button', { name: /Let.s start/ }).click();
  await home.getByRole('button', { name: 'Continue' }).click();
  await home.getByRole('button', { name: 'Not now' }).click();
  await home.getByRole('button', { name: 'Allow' }).click();
  await expect(home.getByRole('img', { name: 'Setup: 2 of 3 steps done' })).toBeVisible();
  await home.getByRole('button', { name: 'Not now' }).click();
  await expect(home.getByRole('button', { name: 'Step 3, Get a heads-up before each break, done' })).toBeVisible();
  await expect(home.getByText('Off for now. You can turn them on from the new tab.')).toBeVisible();
  await expect(home.getByRole('button', { name: 'Start moving' })).toBeVisible();
});
