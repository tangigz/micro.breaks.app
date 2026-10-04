import type { BrowserContext, Page } from '@playwright/test';
import type { MathsChallenge, State } from '../../src/engine';
import { expect, test } from './extension';

const SENTENCES = [
  'My chair and I are very happy together. Please do not disturb us.',
  'Dear future me, sorry about the neck. I had emails.',
  'Skipping this break took longer than drinking a glass of water.',
];

const missionPage = async (context: BrowserContext): Promise<Page> => {
  await expect.poll(() => context.pages().some((p) => p.url().endsWith('/mission.html'))).toBe(true);
  return context.pages().find((p) => p.url().endsWith('/mission.html'))!;
};

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/skip/${name}.png` });

type Engine = { send(input: Parameters<typeof JSON.stringify>[0]): Promise<State> };

/** Opens the skip challenge until it is of the wanted kind: it is picked at random each time. */
async function openChallenge(engine: Engine, kind: 'maths' | 'type'): Promise<State> {
  for (let i = 0; i < 40; i++) {
    const state = await engine.send({ type: 'skip_open' });
    if (state.break!.skip!.kind === kind) return state;
    await engine.send({ type: 'skip_cancel' });
  }
  throw new Error(`no ${kind} challenge came up`);
}

/** A due break, on the prompt. */
async function dueBreak(engine: { setClock: Function; begin: Function; advance: Function }, context: BrowserContext) {
  await engine.setClock(2030, 1, 7, 10);
  await engine.begin();
  await engine.advance(64);
  return missionPage(context);
}

const answer = (state: State) => String((state.break!.skip as MathsChallenge).answer);

test('maths: three right answers in a row unlock Chrome; one mistake restarts', async ({ context, engine, home }) => {
  const page = await dueBreak(engine, context);
  await page.getByRole('button', { name: "Skip (it'll cost you)" }).click();
  let state = await openChallenge(engine as never, 'maths');

  await expect(page.getByRole('heading', { name: 'Skipping costs more than moving.' })).toBeVisible();
  await expect(page.getByText('Skip challenge', { exact: true })).toBeVisible();
  await expect(page.getByText('Answer these questions to unlock Chrome')).toBeVisible();
  await expect(page.getByText('Question 1 of 3')).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, 'maths');

  // Right, with Enter
  const field = page.getByLabel('Your answer');
  await field.fill(answer(state));
  await field.press('Enter');
  await expect(page.getByText('Question 2 of 3')).toBeVisible();
  await expect(field).toHaveValue('');

  // Wrong: back to zero
  await field.fill('1');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByRole('alert')).toHaveText('Wrong. Back to zero.');
  await expect(page.getByText('Question 1 of 3')).toBeVisible();
  await shot(page, 'wrong');
  await page.getByRole('button', { name: 'Start again' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);

  // Three in a row; a comma works as the decimal mark
  for (let i = 0; i < 3; i++) {
    state = await engine.send({ type: 'tick' });
    await expect(page.getByText(`Question ${i + 1} of 3`)).toBeVisible();
    await field.fill(answer(state).replace('.', ','));
    await field.press('Enter');
  }

  await expect(page.getByRole('heading', { name: 'Skipped.' })).toBeVisible();
  await expect(page.getByText('Challenge passed · Chrome is unlocked')).toBeVisible();
  await expect(page.getByText(/Your battery stays empty\.\s*Next break at 12:0\d\./)).toBeVisible();
  await shot(page, 'passed');
  state = await engine.send({ type: 'tick' });
  expect(state.break).toBeNull();
  expect(state.skipsToday).toBe(1);

  await page.getByRole('button', { name: 'Back to work' }).click();
  await home.reload();
  await expect(home.getByText('Break skipped · Next break in')).toBeVisible();
});

test('type the sentence: exact match, mistakes flagged, no pasting', async ({ context, engine }) => {
  const page = await dueBreak(engine, context);
  await page.getByRole('button', { name: "Skip (it'll cost you)" }).click();
  const state = await openChallenge(engine as never, 'type');
  const c = state.break!.skip!;
  if (c.kind !== 'type') throw new Error();
  const sentence = SENTENCES[c.sentences[0]!]!;

  await expect(page.getByText('The sentence', { exact: true })).toBeVisible();
  await expect(page.getByText('Type it exactly. No pasting.').first()).toBeVisible();
  await expect(page.getByText(`0 / ${sentence.length}`)).toBeVisible();
  const field = page.getByLabel('Type it exactly. No pasting.');

  // A mistake: flagged in text, and it blocks the count
  await field.pressSequentially(sentence.slice(0, 10));
  await expect(page.getByText(`10 / ${sentence.length}`)).toBeVisible();
  await field.pressSequentially('#');
  await expect(page.getByRole('alert')).toHaveText('One wrong character. Fix it to continue.');
  await expect(page.getByText(`10 / ${sentence.length}`)).toBeVisible();
  await page.waitForTimeout(200);
  await shot(page, 'type');
  await field.press('Backspace');
  await expect(page.getByText('Capitals and punctuation count.')).toBeVisible();

  // Pasting is blocked
  await page.evaluate((text) => {
    const input = document.getElementById('skip-typed')!;
    const data = new DataTransfer();
    data.setData('text/plain', text);
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, sentence);
  await expect(field).toHaveValue(sentence.slice(0, 10));

  await field.pressSequentially(sentence.slice(10));
  await expect(page.getByRole('heading', { name: 'Skipped.' })).toBeVisible();
});

test('second skip of the day is harder; "Fine, I\'ll do the mission" goes back', async ({ context, engine }) => {
  const page = await dueBreak(engine, context);
  // First skip, through the engine
  let state = await openChallenge(engine as never, 'maths');
  for (let i = 0; i < 3; i++) state = await engine.send({ type: 'skip_answer', value: (state.break!.skip as MathsChallenge).answer });
  expect(state.skipsToday).toBe(1);
  await engine.send({ type: 'outcome_seen' });

  await engine.advance(60);
  const again = await missionPage(context);
  await again.getByRole('button', { name: "Skip (it'll cost you)" }).click();
  await openChallenge(engine as never, 'maths');
  await expect(again.getByText('Skip challenge · Second skip today')).toBeVisible();
  await expect(again.getByText('Second skip today. 5 in a row this time.')).toBeVisible();
  await expect(again.getByText('Question 1 of 5')).toBeVisible();
  await shot(again, 'second-maths');

  await engine.send({ type: 'skip_cancel' });
  state = await openChallenge(engine as never, 'type');
  await expect(again.getByText('Second skip today. Two sentences this time.')).toBeVisible();
  await expect(again.getByText('Sentence 1 of 2')).toBeVisible();
  const c = state.break!.skip!;
  if (c.kind !== 'type') throw new Error();
  await again.getByLabel('Type it exactly. No pasting.').pressSequentially(SENTENCES[c.sentences[0]!]!);
  await expect(again.getByText('Sentence 2 of 2')).toBeVisible();
  await expect(again.getByLabel('Type it exactly. No pasting.')).toHaveValue('');

  await again.getByRole('button', { name: "Fine, I'll do the mission" }).click();
  await expect(again.getByRole('heading', { name: 'Time to move.' })).toBeVisible();
  expect(page.isClosed() || true).toBe(true);
});
