import type { Page } from '@playwright/test';
import type { MathsChallenge } from '../../src/engine';
import { expect, test } from './extension';

// Monday 7 January 2030 and the Saturday after it
const MONDAY = [2030, 1, 7] as const;
const SATURDAY = [2030, 1, 12] as const;

/** Screenshot for comparing with the design, once the battery has finished moving. */
async function shot(page: Page, name: string) {
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `test-results/newtab/${name}.png` });
}

test('normal: battery, countdown and time seated', async ({ engine, home }) => {
  await engine.setClock(...MONDAY, 10);
  await engine.begin();
  await engine.advance(18);
  await expect(home.getByRole('timer')).toHaveText(/^4[12]:\d\d$/);
  await expect(home.getByText('18 min since your last active break')).toBeVisible();
  await expect(home.getByRole('img', { name: 'Battery at 70 percent until your next break' })).toBeVisible();
  await expect(home.getByText('Every 60 min · 9:00–18:00')).toBeVisible();
  await shot(home, 'normal');

  // Start a break now opens the prompt
  await home.getByRole('button', { name: 'Start a break now' }).click();
  await expect.poll(async () => (await engine.send({ type: 'tick' })).break?.voluntary).toBe(true);
});

test('theme: light is one tap away and remembered', async ({ engine, home }) => {
  await engine.setClock(...MONDAY, 10);
  await engine.begin();
  await home.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(home.locator('html')).toHaveAttribute('data-theme', 'light');
  await shot(home, 'normal-light');
  await home.reload();
  await expect(home.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(home.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();
  expect((await engine.send({ type: 'tick' })).settings.theme).toBe('light');
});

test('before working hours', async ({ engine, home }) => {
  await engine.setClock(...MONDAY, 8);
  await engine.begin();
  await expect(home.getByRole('heading', { name: '9:00' })).toBeVisible();
  await expect(home.getByText('Your day starts at 9:00, at your first activity.')).toBeVisible();
  await expect(home.getByRole('button', { name: 'Start a break now' })).toHaveCount(0);
  await shot(home, 'before');
});

test('lunch', async ({ engine, home }) => {
  await engine.setClock(...MONDAY, 12, 45);
  await engine.begin();
  await expect(home.getByRole('heading', { name: 'Lunch.' })).toBeVisible();
  await expect(home.getByText('Tracking paused until 13:30. Your battery will be full.')).toBeVisible();
  await shot(home, 'lunch');
});

test('done for today', async ({ engine, home }) => {
  await engine.setClock(...MONDAY, 19);
  await engine.begin();
  await expect(home.getByRole('heading', { name: 'Done for today.' })).toBeVisible();
  await expect(home.getByText('Monday · 18:00')).toBeVisible();
  await expect(home.getByText('See you tomorrow.')).toBeVisible();
  await expect(home.getByText('Every 60 min')).toHaveCount(0);
  await shot(home, 'done');
});

test('weekend', async ({ engine, home }) => {
  await engine.setClock(...SATURDAY, 11);
  await engine.send({ type: 'settings', patch: { days: 'weekdays' } });
  await engine.begin();
  await expect(home.getByRole('heading', { name: 'Weekend.' })).toBeVisible();
  await expect(home.getByText('See you Monday at 9:00.')).toBeVisible();
  await shot(home, 'weekend');
});

test('meeting: the pill, then a held prompt', async ({ engine, home }) => {
  await engine.setClock(...MONDAY, 10);
  const state = await engine.begin();
  // What a connected calendar leaves in storage: one meeting, from now until 11:30
  await home.evaluate((busy) => chrome.storage.local.set({ calendarBusy: busy }), [[state.seatedSince!, state.seatedSince! + 90 * 60_000]]);
  await engine.send({ type: 'settings', patch: { calendar: true } });
  await engine.advance(18);
  await expect(home.getByRole('status')).toHaveText('In a meeting until 11:30. Prompts wait.');
  await shot(home, 'meeting');

  await engine.advance(47);
  await expect(home.getByRole('heading', { name: 'In a meeting.' })).toBeVisible();
  await expect(home.getByText('Break due at 11:00')).toBeVisible();
  await expect(home.getByText('Your break is waiting. It opens at 11:30, when the meeting ends.')).toBeVisible();
  await shot(home, 'held');
});

test('after a skip', async ({ context, engine, home }) => {
  await engine.setClock(...MONDAY, 10);
  await engine.begin();
  await engine.advance(68);
  let state = await engine.send({ type: 'skip_open' });
  for (let i = 0; state.break?.skip && i < 10; i++) {
    const c = state.break.skip;
    state = await engine.send(
      c.kind === 'maths'
        ? { type: 'skip_answer', value: (c as MathsChallenge).answer }
        : { type: 'skip_sentence', text: await home.evaluate((n) => n, sentence(c.sentences[c.done]!)) },
    );
  }
  expect(state.outcome?.kind).toBe('skipped');
  await context.pages().find((p) => p.url().endsWith('/mission.html'))?.close();
  await home.bringToFront();
  await expect(home.getByText('Break skipped · Next break in')).toBeVisible();
  await expect(home.getByRole('timer')).toHaveText(/^(59:\d\d|60:00)$/);
  await expect(home.getByText('1 h 08 since your last active break')).toBeVisible();
  await expect(home.getByRole('img', { name: 'Battery empty, the break was skipped' })).toBeVisible();
  await shot(home, 'skipped');
});

test('Chrome was closed: one question', async ({ engine, home }) => {
  await engine.setClock(...MONDAY, 10);
  await engine.begin();
  await engine.advance(12);
  await engine.jump(40);
  await engine.send({ type: 'startup' });
  await expect(home.getByRole('dialog')).toContainText('Chrome was closed for 40 min');
  await expect(home.getByRole('heading', { name: 'Did you step away?' })).toBeVisible();
  await shot(home, 'gap');

  await home.getByRole('button', { name: 'No, I kept working' }).click();
  await expect(home.getByText('52 min since your last active break')).toBeVisible();
});

function sentence(index: number): string {
  return [
    'My chair and I are very happy together. Please do not disturb us.',
    'Dear future me, sorry about the neck. I had emails.',
    'Skipping this break took longer than drinking a glass of water.',
  ][index]!;
}
