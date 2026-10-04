import type { Page } from '@playwright/test';
import { expect, test } from './extension';

const at = (h: number, m = 0) => new Date(2030, 0, 7, h, m).getTime();

/** Stands in for Google: the busy blocks the extension would get from the calendar. */
const fakeCalendar = (page: Page, busy: [number, number][]) =>
  page.evaluate((b) => chrome.storage.local.set({ testCalendar: b }), busy);

test('without an OAuth client, connecting says so and changes nothing', async ({ engine, home }) => {
  await engine.setClock(2030, 1, 7, 10);
  await engine.begin();
  await home.goto(home.url().replace('newtab.html', 'settings.html'));
  await home.getByRole('button', { name: 'Meetings, meetings' }).click();
  await expect(home.getByText('Skip my meetings')).toBeVisible();
  await expect(home.getByText('Read-only, busy times only.')).toBeVisible();
  await home.screenshot({ path: 'test-results/calendar/tray.png' });
  await home.getByRole('button', { name: 'Connect Google Calendar' }).click();
  await expect(home.getByRole('alert')).toHaveText('Google Calendar is not set up for this build yet.');
  expect((await engine.send({ type: 'tick' })).settings.calendar).toBe(false);
});

test('connected: the meeting pill, a held prompt, then the prompt when the meeting ends', async ({ context, engine, home }) => {
  await engine.setClock(2030, 1, 7, 10);
  await engine.begin();
  // Two back-to-back meetings, 10:50–11:15 and 11:15–11:30
  await fakeCalendar(home, [
    [at(10, 50), at(11, 15)],
    [at(11, 15), at(11, 30)],
  ]);

  await home.goto(home.url().replace('newtab.html', 'settings.html'));
  await home.getByRole('button', { name: 'Meetings, meetings' }).click();
  await home.getByRole('button', { name: 'Connect Google Calendar' }).click();
  await expect(home.getByText('Connected', { exact: true })).toBeVisible();
  await expect(home.getByText('No prompts while you are in a meeting.')).toBeVisible();
  await expect(home.getByRole('button', { name: 'Meetings, my Google meetings' })).toBeVisible();
  await home.screenshot({ path: 'test-results/calendar/connected.png' });
  expect((await engine.send({ type: 'tick' })).settings.calendar).toBe(true);
  await home.getByRole('link', { name: 'Back' }).click();

  // Before the meeting: nothing special
  await engine.advance(45);
  await expect(home.getByRole('status')).toHaveCount(0);

  // In the meeting, nothing due yet: the pill, and no heads-up
  await engine.advance(10);
  await expect(home.getByRole('status')).toHaveText('In a meeting until 11:30. Prompts wait.');
  expect(await engine.notifications()).toEqual([]);

  // Due during the meeting: held
  await engine.advance(10);
  await expect(home.getByRole('heading', { name: 'In a meeting.' })).toBeVisible();
  await expect(home.getByText('Your break is waiting. It opens at 11:30, when the meeting ends.')).toBeVisible();
  expect((await engine.send({ type: 'tick' })).break).toBeNull();

  // The meeting ends: the prompt opens
  const state = await engine.advance(25);
  expect(state.break?.phase).toBe('prompt');
  await expect.poll(() => context.pages().some((p) => p.url().endsWith('/mission.html'))).toBe(true);
  expect(await engine.notifications()).toEqual(['break']);
});

test('disconnecting stops holding prompts', async ({ engine, home }) => {
  await engine.setClock(2030, 1, 7, 10);
  await engine.begin();
  await fakeCalendar(home, [[at(10), at(12)]]);
  await home.goto(home.url().replace('newtab.html', 'settings.html'));
  await home.getByRole('button', { name: 'Meetings, meetings' }).click();
  await home.getByRole('button', { name: 'Connect Google Calendar' }).click();
  await expect(home.getByText('Connected', { exact: true })).toBeVisible();
  expect((await engine.send({ type: 'tick' })).meetingUntil).toBe(at(12));

  await home.getByRole('button', { name: 'Disconnect' }).click();
  await expect(home.getByRole('button', { name: 'Connect Google Calendar' })).toBeVisible();
  const state = await engine.send({ type: 'tick' });
  expect(state.settings.calendar).toBe(false);
  expect(state.meetingUntil).toBeNull();
  expect((await engine.advance(60)).break?.phase).toBe('prompt');
});

test('"All set." offers Google Calendar', async ({ home }) => {
  await fakeCalendar(home, []);
  await home.evaluate(() => chrome.storage.local.set({ setup: { started: true, timer: true, notifications: 3, login: 2 } }));
  await home.reload();
  await expect(home.getByRole('heading', { name: 'All set.' })).toBeVisible();
  await expect(home.getByText('Optional: connect Google Calendar so prompts wait for your meetings to end.')).toBeVisible();
  await home.getByRole('button', { name: 'Connect Google Calendar' }).click();
  await expect(home.getByText('Google Calendar connected')).toBeVisible();
  await expect(home.getByText('No prompts during your meetings.')).toBeVisible();
  await home.waitForTimeout(1200);
  await home.screenshot({ path: 'test-results/calendar/all-set.png' });
});
