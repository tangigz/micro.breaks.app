import type { Page } from '@playwright/test';
import { expect, test } from './extension';

async function shot(page: Page, name: string) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/setup/${name}.png` });
}

test('install opens the welcome flow, and every new tab leads to it until it is finished', async ({ context, home }) => {
  await expect(home).toHaveURL(/setup\.html$/);
  await expect(home.getByRole('heading', { name: 'Stay charged all day.' })).toBeVisible();
  expect(context.pages().filter((p) => p.url().endsWith('/setup.html')).length).toBeGreaterThanOrEqual(1);
});

test('welcome, three steps, all set, start moving', async ({ engine, home }) => {
  await engine.setClock(2030, 1, 7, 10);
  await expect(home.getByText('More energy')).toBeVisible();
  await expect(home.getByText('Three steps to set your daily movement timer.')).toBeVisible();
  await shot(home, 'welcome');
  await home.getByRole('button', { name: "Let's start" }).click();

  // Step 1: movement timer, editable in place
  await expect(home.getByRole('navigation', { name: 'Step 1 of 3' })).toBeVisible();
  await expect(home.getByRole('heading', { name: 'Set your movement timer.' })).toBeVisible();
  await expect(home.getByText('Click any highlighted word to change it.')).toBeVisible();
  await shot(home, 'step-1');
  await home.getByRole('button', { name: 'Interval, 60 min' }).click();
  await home.getByRole('button', { name: 'Previous value' }).click();
  await shot(home, 'step-1-tray');
  await home.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(home.getByRole('button', { name: 'Interval, 45 min' })).toBeVisible();
  await home.getByRole('button', { name: 'Continue' }).click();
  expect((await engine.send({ type: 'tick' })).settings.intervalMin).toBe(45);

  // Step 2: notifications, with a real test notification
  await expect(home.getByRole('heading', { name: 'Make notifications stay.' })).toBeVisible();
  await expect(home.getByRole('button', { name: 'Step 1, done' })).toBeVisible();
  await home.getByRole('button', { name: 'Allow' }).click();
  await expect(home.getByText('Allowed. Now set Chrome to Alerts')).toBeVisible();
  await shot(home, 'step-2');
  await home.getByRole('button', { name: 'Send a test' }).click();
  await expect(home.getByText('Did the test stay on screen until you closed it?')).toBeVisible();
  await expect.poll(() => engine.notifications()).toEqual(['test']);
  await home.getByRole('button', { name: 'Yes, it stayed' }).click();

  // Step 3: Chrome at login
  await expect(home.getByRole('heading', { name: 'Open Chrome at login.' })).toBeVisible();
  await home.getByRole('button', { name: 'Show me how' }).click();
  await expect(home.getByText('System Settings › General › Login Items › “+” › Google Chrome.')).toBeVisible();
  await shot(home, 'step-3-how');

  // A closed tab resumes where it left off
  await home.reload();
  await expect(home.getByRole('button', { name: 'Step 2, done' })).toBeVisible();
  await expect(home.getByRole('heading', { name: 'Open Chrome at login.' })).toBeVisible();
  await home.getByRole('button', { name: 'Done', exact: true }).click();

  // All set
  await expect(home.getByText('Setup complete')).toBeVisible();
  await expect(home.getByRole('heading', { name: 'All set.' })).toBeVisible();
  await shot(home, 'all-set');
  expect((await engine.send({ type: 'tick' })).setupDone).toBe(false);
  await home.getByRole('button', { name: 'Start moving' }).click();

  await expect(home).toHaveURL(/newtab\.html$/);
  await expect(home.getByText('Next break in')).toBeVisible();
  const state = await engine.send({ type: 'tick' });
  expect(state.setupDone).toBe(true);
  expect(state.seatedSince).not.toBeNull();
});

test('a progress segment reopens its step', async ({ home }) => {
  await home.getByRole('button', { name: "Let's start" }).click();
  await home.getByRole('button', { name: 'Continue' }).click();
  await expect(home.getByRole('heading', { name: 'Make notifications stay.' })).toBeVisible();
  await home.getByRole('button', { name: 'Step 1, done' }).click();
  await expect(home.getByRole('heading', { name: 'Set your movement timer.' })).toBeVisible();
  await home.getByRole('button', { name: 'Continue' }).click();
  await expect(home.getByRole('heading', { name: 'Make notifications stay.' })).toBeVisible();
});

test('movement timer: every highlighted word is editable', async ({ engine, home }) => {
  await engine.setClock(2030, 1, 7, 10);
  await engine.begin();
  await home.getByRole('link', { name: /Edit your movement timer/ }).click();
  await expect(home).toHaveURL(/settings\.html$/);
  await expect(home.getByText('Click any highlighted word to change it.')).toBeVisible();
  await shot(home, 'timer');

  // Interval, with the arrows of the tray
  await home.getByRole('button', { name: 'Interval, 60 min' }).click();
  await expect(home.getByRole('option', { selected: true })).toHaveText('60 min');
  await shot(home, 'timer-tray');
  await home.getByRole('button', { name: 'Previous value' }).click();
  await expect(home.getByRole('button', { name: 'Interval, 45 min' })).toBeVisible();
  await home.getByRole('button', { name: 'Done', exact: true }).click();

  // Start of day, with the keyboard
  await home.getByRole('button', { name: 'Start of day, 9:00' }).click();
  await home.keyboard.press('ArrowLeft');
  await home.keyboard.press('ArrowLeft');
  await expect(home.getByRole('button', { name: 'Start of day, 8:30' })).toBeVisible();
  await home.keyboard.press('Enter');
  await expect(home.getByText('Click any highlighted word to change it.')).toBeVisible();

  // Lunch can't end before it starts: the tray stops at the first value after 12:30
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
