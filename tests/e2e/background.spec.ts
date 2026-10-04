import { expect, test } from './extension';

test('a full cycle: heads-up, prompt, mission, recharged', async ({ context, engine }) => {
  // Working hours around the clock and no lunch, so the test passes at any time of day
  await engine.send({ type: 'settings', patch: { dayStart: 0, dayEnd: 24 * 60, lunchStart: 0, lunchEnd: 0 } });
  await engine.send({ type: 'setup_done' });
  let state = await engine.send({ type: 'idle', state: 'active' });
  expect(state.seatedSince).not.toBeNull();

  state = await engine.advance(55);
  expect(await engine.notifications()).toEqual(['headsup']);
  expect(state.break).toBeNull();

  // Break time: the notification, and the mission tab opens and takes the front
  state = await engine.advance(5);
  expect(state.break?.phase).toBe('prompt');
  expect(await engine.notifications()).toEqual(['break']);
  await expect.poll(() => context.pages().some((p) => p.url().endsWith('/mission.html'))).toBe(true);
  const mission = context.pages().find((p) => p.url().endsWith('/mission.html'))!;
  await expect(mission.getByRole('heading')).toHaveText('Time to move.');
  expect(await mission.evaluate(() => document.visibilityState)).toBe('visible');

  // The mission timer only runs while away
  await mission.getByRole('button', { name: 'Start mission' }).click();
  await expect(mission.getByText('paused')).toBeVisible();
  await engine.send({ type: 'idle', state: 'locked' });
  state = await engine.advance(5);
  expect(state.break).toBeNull();
  expect(state.outcome?.kind).toBe('mission');
  expect(await engine.notifications()).toEqual(['mission_done']);
  await expect(mission.getByRole('heading')).toHaveText('Recharged.');

  expect(await engine.events()).toEqual([
    'setting_changed',
    'day_start',
    'headsup_sent',
    'prompt_shown',
    'mission_started',
    'mission_completed',
  ]);
});

test('the state survives the service worker stopping', async ({ context, engine, home }) => {
  await engine.send({ type: 'settings', patch: { dayStart: 0, dayEnd: 24 * 60, lunchStart: 0, lunchEnd: 0 } });
  await engine.send({ type: 'setup_done' });
  const before = await engine.send({ type: 'idle', state: 'active' });

  const saved = await home.evaluate(() => chrome.storage.local.get('state'));
  expect(saved.state.seatedSince).toBe(before.seatedSince);
  expect(await home.evaluate(() => chrome.alarms.get('tick'))).toMatchObject({ periodInMinutes: 1 });

  // Stop the worker, then wake it with a message: it picks the saved state back up
  const cdp = await context.newCDPSession(home);
  await cdp.send('ServiceWorker.enable');
  await cdp.send('ServiceWorker.stopAllWorkers');
  const after = await engine.send({ type: 'tick' });
  expect(after.seatedSince).toBe(before.seatedSince);
  expect(after.seed).toBe(before.seed);
});
