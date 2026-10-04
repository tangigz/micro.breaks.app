import { rand, randInt } from './rng';
import type { Challenge, MathsChallenge, State } from './types';

export const SENTENCES = [
  'My chair and I are very happy together. Please do not disturb us.',
  'Dear future me, sorry about the neck. I had emails.',
  'Skipping this break took longer than drinking a glass of water.',
];

function question(s: State): { question: string; answer: number } {
  const kind = randInt(s, 0, 2);
  if (kind === 0) {
    const a = randInt(s, 12, 49);
    const b = randInt(s, 3, 9);
    return { question: `${a} × ${b}`, answer: a * b };
  }
  if (kind === 1) {
    const p = [5, 15, 17, 20, 35][randInt(s, 0, 4)]!;
    const n = randInt(s, 2, 18) * 50;
    return { question: `${p}% of ${n}`, answer: (p * n) / 100 };
  }
  const d = randInt(s, 3, 9);
  const q = randInt(s, 12, 60);
  return { question: `${d * q} ÷ ${d}`, answer: q };
}

/** One of two, picked at random. The second skip of the day is harder. */
export function newChallenge(s: State): Challenge {
  const second = s.skipsToday >= 1;
  if (rand(s) < 0.5) {
    return { kind: 'maths', need: second ? 5 : 3, streak: 0, wrong: false, ...question(s) };
  }
  // Never the same sentence twice in a row
  const pool = SENTENCES.map((_, i) => i).filter((i) => i !== s.lastSentence);
  const first = pool[randInt(s, 0, pool.length - 1)]!;
  const sentences = [first];
  if (second) {
    const rest = SENTENCES.map((_, i) => i).filter((i) => i !== first);
    sentences.push(rest[randInt(s, 0, rest.length - 1)]!);
  }
  s.lastSentence = sentences[sentences.length - 1]!;
  return { kind: 'type', sentences, done: 0 };
}

export function nextQuestion(s: State, c: MathsChallenge): void {
  Object.assign(c, question(s), { wrong: false });
}

/** True when the series is complete. One wrong answer restarts it. */
export function answerMaths(s: State, c: MathsChallenge, value: number): boolean {
  if (c.wrong) return false;
  if (Math.abs(value - c.answer) > 1e-9) {
    c.wrong = true;
    c.streak = 0;
    return false;
  }
  c.streak += 1;
  if (c.streak >= c.need) return true;
  nextQuestion(s, c);
  return false;
}
