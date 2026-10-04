import { describe, expect, it } from 'vitest';
import { initialState, isLocked, nextWake, step } from './engine';
import { MISSIONS } from './missions';
import { SENTENCES } from './challenge';
import { MIN } from './time';
import type { Effect, Input, MathsChallenge, State } from './types';
import { batteryLevel, missionView, newTabView } from './view';

/** Monday 5 October 2026, local time. */
const at = (h: number, m = 0, s = 0, day = 5) => new Date(2026, 9, day, h, m, s).getTime();

/** A fake clock around the engine: one tick per minute, like the background's alarm. */
class Sim {
  state: State;
  now: number;
  effects: Effect[] = [];

  constructor(start: number, seed = 1) {
    this.now = start;
    this.state = initialState(start, seed);
    this.send({ type: 'setup_done' });
  }

  send(input: Input) {
    const r = step(this.state, input, this.now);
    this.state = r.state;
    this.effects.push(...r.effects);
    return r.effects;
  }

  /** Moves the clock, ticking every minute. */
  to(target: number) {
    while (this.now + MIN <= target) {
      this.now += MIN;
      this.send({ type: 'tick' });
    }
    if (this.now < target) {
      this.now = target;
      this.send({ type: 'tick' });
    }
  }

  wait(min: number) {
    this.to(this.now + min * MIN);
  }

  /** The user stops touching the computer; chrome.idle reports it after the detection interval. */
  leave(detectionMin = 5) {
    this.wait(detectionMin);
    this.send({ type: 'idle', state: 'idle', idleForMs: detectionMin * MIN });
  }

  back() {
    this.send({ type: 'idle', state: 'active' });
  }

  logged(event: string) {
    return this.effects.filter((e) => e.type === 'log' && e.event === event);
  }

  notified(kind: string) {
    return this.effects.filter((e) => e.type === 'notify' && e.kind === kind).length;
  }

  /** Completes the open mission by staying away for its whole length. */
  doMission() {
    this.send({ type: 'start_mission' });
    this.send({ type: 'idle', state: 'locked' });
    this.wait(this.state.break!.durationMs / MIN);
  }

  /** Solves whatever challenge is open. */
  passSkip() {
    this.send({ type: 'skip_open' });
    for (let guard = 0; this.state.break?.skip && guard < 20; guard++) {
      const c = this.state.break.skip;
      if (c.kind === 'maths') this.send({ type: 'skip_answer', value: c.answer });
      else this.send({ type: 'skip_sentence', text: SENTENCES[c.sentences[c.done]!]! });
    }
  }
}

/** A working day already under way: first activity at 9:00. */
const working = (seed = 1) => new Sim(at(9, 0), seed);

describe('movement timer', () => {
  it('starts the seated timer at the first activity inside working hours', () => {
    const sim = new Sim(at(8, 30));
    expect(sim.state.seatedSince).toBeNull();
    expect(newTabView(sim.state, sim.now).mode).toBe('before');
    sim.to(at(9, 0));
    expect(sim.state.seatedSince).toBe(at(9, 0));
    expect(sim.logged('day_start')).toHaveLength(1);
  });

  it('waits for activity when the user is away at the start of the day', () => {
    const sim = new Sim(at(8, 30));
    sim.send({ type: 'idle', state: 'locked' });
    sim.to(at(9, 20));
    expect(sim.state.seatedSince).toBeNull();
    sim.back();
    expect(sim.state.seatedSince).toBe(at(9, 20));
  });

  it('drains the battery over the interval', () => {
    const sim = working();
    expect(batteryLevel(sim.state, sim.now)).toBe(100);
    sim.wait(30);
    expect(batteryLevel(sim.state, sim.now)).toBe(50);
    sim.wait(45);
    expect(batteryLevel(sim.state, sim.now)).toBe(0);
  });

  it('sends the heads-up once, 5 min before, then opens the prompt', () => {
    const sim = working();
    sim.to(at(9, 54));
    expect(sim.notified('headsup')).toBe(0);
    sim.to(at(9, 59));
    expect(sim.notified('headsup')).toBe(1);
    expect(sim.state.break).toBeNull();
    sim.to(at(10, 0));
    expect(sim.state.break?.phase).toBe('prompt');
    expect(sim.effects).toContainEqual({ type: 'notify', kind: 'break', seatedMin: 60 });
    expect(sim.effects).toContainEqual({ type: 'open_prompt' });
    expect(isLocked(sim.state)).toBe(true);
  });

  it('follows a changed interval', () => {
    const sim = working();
    sim.wait(10);
    sim.send({ type: 'settings', patch: { intervalMin: 30 } });
    expect(sim.state.dueAt).toBe(at(9, 30));
  });

  it('never prompts outside working hours or on days off', () => {
    const sim = new Sim(at(18, 30));
    sim.to(at(23, 0));
    expect(sim.state.seatedSince).toBeNull();
    expect(newTabView(sim.state, sim.now).mode).toBe('done');

    const weekend = new Sim(at(10, 0, 0, 10)); // Saturday
    weekend.send({ type: 'settings', patch: { days: 'weekdays' } });
    weekend.wait(120);
    expect(weekend.state.seatedSince).toBeNull();
    expect(weekend.notified('break')).toBe(0);
    expect(newTabView(weekend.state, weekend.now).mode).toBe('weekend');
  });

  it('ends the day: tracking stops and an unstarted prompt is dismissed', () => {
    const sim = new Sim(at(17, 0));
    sim.to(at(18, 0));
    expect(sim.state.break).toBeNull();
    expect(sim.state.seatedSince).toBeNull();
    expect(sim.logged('day_end')).toHaveLength(1);
  });

  it('lets a running mission finish after the end of the day', () => {
    const sim = new Sim(at(16, 58));
    sim.to(at(17, 58));
    sim.send({ type: 'start_mission' });
    sim.send({ type: 'idle', state: 'locked' });
    sim.to(at(18, 1));
    expect(sim.state.break?.phase).toBe('mission');
    sim.to(at(18, 3));
    expect(sim.state.outcome?.kind).toBe('mission');
  });

  it('resets on a new day', () => {
    const sim = working();
    sim.wait(60);
    sim.passSkip();
    expect(sim.state.skipsToday).toBe(1);
    sim.to(at(9, 0, 0, 6));
    expect(sim.state.skipsToday).toBe(0);
    expect(sim.state.seatedSince).toBe(at(9, 0, 0, 6));
  });
});

describe('recharging', () => {
  it('recharges after 5+ min away without a prompt', () => {
    const sim = working();
    sim.wait(20);
    sim.leave();
    expect(sim.state.seatedSince).toBeNull();
    expect(sim.state.outcome?.kind).toBe('away');
    expect(batteryLevel(sim.state, sim.now)).toBe(100);
    sim.wait(4);
    sim.back();
    expect(sim.state.seatedSince).toBe(sim.now);
    expect(sim.state.dueAt).toBe(sim.now + 60 * MIN);
  });

  it('counts a pause under 5 min as seated', () => {
    const sim = working();
    sim.wait(20);
    sim.send({ type: 'idle', state: 'locked' });
    sim.wait(4);
    sim.back();
    expect(sim.state.seatedSince).toBe(at(9, 0));
    expect(sim.state.outcome).toBeNull();
  });

  it('recharges after 5 min with the screen locked', () => {
    const sim = working();
    sim.wait(20);
    sim.send({ type: 'idle', state: 'locked' });
    sim.wait(5);
    expect(sim.state.outcome?.kind).toBe('away');
  });

  it('recharges at lunch and restarts after it', () => {
    const sim = new Sim(at(12, 0));
    sim.to(at(12, 30));
    expect(sim.state.seatedSince).toBeNull();
    expect(newTabView(sim.state, sim.now).mode).toBe('lunch');
    sim.to(at(13, 29));
    expect(sim.state.seatedSince).toBeNull();
    sim.to(at(13, 30));
    expect(sim.state.seatedSince).toBe(at(13, 30));
    expect(sim.notified('break')).toBe(0);
  });

  it('dismisses a prompt that is still open when lunch starts', () => {
    const sim = new Sim(at(11, 25));
    sim.to(at(12, 25));
    expect(sim.state.break?.phase).toBe('prompt');
    sim.to(at(12, 30));
    expect(sim.state.break).toBeNull();
    expect(sim.effects).toContainEqual({ type: 'unlock' });
  });

  it('recharges and unlocks when the user walks away from the prompt', () => {
    const sim = working();
    sim.wait(60);
    expect(sim.state.break?.phase).toBe('prompt');
    sim.leave();
    expect(sim.state.break).toBeNull();
    expect(sim.state.outcome?.kind).toBe('away');
    expect(sim.logged('away_break')[0]).toMatchObject({ payload: { atPrompt: true } });
  });

  it('does not recharge on idle time during a meeting', () => {
    const sim = working();
    sim.wait(10);
    sim.send({ type: 'calendar', busyUntil: at(9, 40) });
    sim.leave(5);
    sim.to(at(9, 38));
    sim.back();
    expect(sim.state.seatedSince).toBe(at(9, 0));
    expect(sim.state.outcome).toBeNull();
  });
});

describe('meetings', () => {
  it('holds a prompt due in a meeting until it ends', () => {
    const sim = working();
    sim.wait(50);
    sim.send({ type: 'calendar', busyUntil: at(10, 30) });
    sim.to(at(10, 5));
    expect(sim.state.break).toBeNull();
    expect(sim.notified('headsup')).toBe(0);
    expect(sim.logged('prompt_held')).toHaveLength(1);
    expect(newTabView(sim.state, sim.now).mode).toBe('held');
    sim.to(at(10, 30));
    expect(sim.state.break?.phase).toBe('prompt');
  });

  it('shows the meeting while nothing is due', () => {
    const sim = working();
    sim.send({ type: 'calendar', busyUntil: at(9, 30) });
    sim.wait(10);
    expect(newTabView(sim.state, sim.now)).toMatchObject({ mode: 'meeting', meetingUntil: at(9, 30) });
  });
});

describe('Chrome was closed', () => {
  it('counts under 5 min as seated, without a question', () => {
    const sim = working();
    sim.wait(20);
    sim.now += 4 * MIN;
    sim.send({ type: 'startup' });
    expect(sim.state.gap).toBeNull();
    expect(sim.state.seatedSince).toBe(at(9, 0));
  });

  it('asks after 5 min or more; yes recharges', () => {
    const sim = working();
    sim.wait(20);
    sim.now += 40 * MIN;
    const fx = sim.send({ type: 'startup' });
    expect(fx).toContainEqual({ type: 'open_home' });
    expect(newTabView(sim.state, sim.now)).toMatchObject({ mode: 'gap', gapMs: 40 * MIN });
    sim.send({ type: 'gap_answer', moved: true });
    expect(sim.state.outcome?.kind).toBe('gap');
    expect(sim.state.seatedSince).toBe(sim.now);
  });

  it('counts no, or no answer, as seated', () => {
    const sim = working();
    sim.wait(20);
    sim.now += 40 * MIN;
    sim.send({ type: 'startup' });
    expect(sim.state.break?.phase).toBe('prompt'); // 60 min seated: the prompt is due
    sim.send({ type: 'gap_answer', moved: false });
    expect(sim.state.seatedSince).toBe(at(9, 0));
  });

  it('does not ask when the gap covers lunch or the night', () => {
    const lunch = new Sim(at(12, 0));
    lunch.wait(10);
    lunch.now = at(13, 40);
    lunch.send({ type: 'startup' });
    expect(lunch.state.gap).toBeNull();
    expect(lunch.state.seatedSince).toBe(at(13, 40));

    const night = new Sim(at(17, 0));
    night.wait(10);
    night.now = at(9, 5, 0, 6);
    night.send({ type: 'startup' });
    expect(night.state.gap).toBeNull();
  });

  it('reopens the prompt when Chrome restarts during a lock', () => {
    const sim = working();
    sim.wait(60);
    sim.now += 2 * MIN;
    expect(sim.send({ type: 'startup' })).toContainEqual({ type: 'open_prompt' });
  });
});

describe('the break', () => {
  it('goes through all 7 missions before any repeat', () => {
    const sim = working(7);
    const seen: string[] = [];
    for (let i = 0; i < 14; i++) {
      sim.send({ type: 'start_break_now' });
      seen.push(sim.state.break!.missionId);
      sim.send({ type: 'cancel_break' });
    }
    expect(new Set(seen.slice(0, 7)).size).toBe(7);
    expect(new Set(seen.slice(7)).size).toBe(7);
    expect(seen[7]).not.toBe(seen[6]);
  });

  it('switches the mission once per break', () => {
    const sim = working();
    sim.wait(60);
    const first = sim.state.break!.missionId;
    sim.send({ type: 'switch_mission' });
    const second = sim.state.break!.missionId;
    expect(second).not.toBe(first);
    sim.send({ type: 'switch_mission' });
    expect(sim.state.break!.missionId).toBe(second);
  });

  it('only counts down while the user is away, crediting the idle detection delay', () => {
    const sim = working();
    sim.wait(60);
    sim.send({ type: 'start_mission' });
    expect(missionView(sim.state, sim.now)).toMatchObject({ running: false, remainingMs: 5 * MIN });

    // Still typing: nothing moves
    sim.wait(1);
    expect(missionView(sim.state, sim.now)!.remainingMs).toBe(5 * MIN);
    sim.back();

    // Away for 2 min; chrome.idle reports it 15 s in
    sim.now += 15_000;
    sim.send({ type: 'idle', state: 'idle', idleForMs: 15_000 });
    expect(missionView(sim.state, sim.now)).toMatchObject({ running: true, remainingMs: 5 * MIN - 15_000 });
    sim.now += 105_000;
    sim.back();
    expect(missionView(sim.state, sim.now)).toMatchObject({ running: false, remainingMs: 3 * MIN });
    expect(sim.logged('mission_paused')).toHaveLength(1);

    // Away again until the end
    sim.send({ type: 'idle', state: 'locked' });
    expect(nextWake(sim.state)).toBe(sim.now + 3 * MIN);
    sim.wait(3);
    expect(sim.state.break).toBeNull();
    expect(sim.state.outcome?.kind).toBe('mission');
    expect(sim.notified('mission_done')).toBe(1);
    expect(isLocked(sim.state)).toBe(false);
  });

  it('does not credit time before the last activity', () => {
    const sim = working();
    sim.wait(60);
    sim.send({ type: 'start_mission' });
    sim.now += 5_000;
    sim.send({ type: 'idle', state: 'idle', idleForMs: 15_000 });
    expect(missionView(sim.state, sim.now)!.remainingMs).toBe(5 * MIN - 5_000);
  });

  it('restarts the seated timer from zero after a completed mission', () => {
    const sim = working();
    sim.wait(60);
    sim.doMission();
    expect(sim.state.seatedSince).toBeNull();
    expect(batteryLevel(sim.state, sim.now)).toBe(100);
    sim.wait(2);
    sim.back();
    expect(sim.state.seatedSince).toBe(sim.now);
  });

  it('video mission: runs on the clock, one video per break, rotating, and ends with "I\'ve done the routine"', () => {
    const video = MISSIONS.find((m) => m.id === 'stretch')!;
    const sim = working();
    const play = (videoDurationMs: number) => {
      sim.send({ type: 'start_break_now' });
      sim.state.break!.missionId = video.id;
      sim.send({ type: 'start_mission', videoDurationMs });
      const b = sim.state.break!;
      // Too early: the button does nothing
      sim.send({ type: 'video_done' });
      expect(sim.state.break).not.toBeNull();
      // Touching the keyboard changes nothing, and neither does being away
      sim.wait(b.durationMs / MIN - 1);
      sim.back();
      expect(missionView(sim.state, sim.now)).toMatchObject({ video: true, remainingMs: MIN });
      sim.wait(1);
      expect(sim.state.break).not.toBeNull();
      sim.send({ type: 'video_done' });
      expect(sim.state.break).toBeNull();
      expect(sim.state.outcome?.kind).toBe('mission');
      return b;
    };
    expect(play(4 * MIN)).toMatchObject({ videoIndex: 0, durationMs: 4 * MIN });
    expect(play(7 * MIN)).toMatchObject({ videoIndex: 1, durationMs: 7 * MIN });
    expect(play(3 * MIN).videoIndex).toBe(2);
    expect(play(3 * MIN).videoIndex).toBe(0);
  });

  it('a trimmed video lasts from its start to its end', () => {
    const boost = MISSIONS.find((m) => m.id === 'boost')!;
    expect(boost.videos![0]).toMatchObject({ start: 40, end: 170 });
    const sim = working();
    sim.send({ type: 'start_break_now' });
    sim.state.break!.missionId = boost.id;
    sim.send({ type: 'start_mission' });
    expect(sim.state.break).toMatchObject({ durationMs: 130_000, videoIndex: 0 });
    expect(sim.state.break!.awaitingVideoDuration).toBeFalsy();
  });

  it('takes the length of an untrimmed video from the player, keeping the time already spent away', () => {
    const video = MISSIONS.find((m) => m.id === 'stretch')!;
    const sim = working();
    sim.send({ type: 'start_break_now' });
    sim.state.break!.missionId = video.id;
    sim.send({ type: 'start_mission' });
    expect(sim.state.break).toMatchObject({ durationMs: 5 * MIN, awaitingVideoDuration: true });
    sim.wait(1);
    sim.send({ type: 'video_duration', ms: 7 * MIN });
    expect(missionView(sim.state, sim.now)).toMatchObject({ durationMs: 7 * MIN, remainingMs: 6 * MIN });
    // Reported once: a second report changes nothing
    sim.send({ type: 'video_duration', ms: 2 * MIN });
    expect(sim.state.break!.durationMs).toBe(7 * MIN);
  });

  it('"Start a break now" opens the same prompt, free to cancel until the mission starts', () => {
    const sim = working();
    sim.wait(10);
    sim.send({ type: 'start_break_now' });
    expect(sim.state.break).toMatchObject({ phase: 'prompt', voluntary: true });
    expect(sim.notified('break')).toBe(0);
    sim.send({ type: 'cancel_break' });
    expect(sim.state.break).toBeNull();
    expect(sim.state.seatedSince).toBe(at(9, 0));

    sim.send({ type: 'start_break_now' });
    sim.send({ type: 'start_mission' });
    sim.send({ type: 'cancel_break' });
    expect(sim.state.break?.phase).toBe('mission');
  });

  it('an early break left open becomes the real one when it is due', () => {
    const sim = working();
    sim.wait(58);
    sim.send({ type: 'start_break_now' });
    sim.wait(2);
    sim.send({ type: 'cancel_break' });
    expect(sim.state.break).toMatchObject({ phase: 'prompt', voluntary: false });
  });
});

describe('skipping', () => {
  /** A seed whose first challenge is of the wanted kind. */
  const withChallenge = (kind: 'maths' | 'type', skips = 0) => {
    for (let seed = 1; seed < 50; seed++) {
      const sim = working(seed);
      sim.wait(60);
      for (let i = 0; i < skips; i++) {
        sim.passSkip();
        sim.wait(60);
      }
      sim.send({ type: 'skip_open' });
      if (sim.state.break!.skip!.kind === kind) return sim;
    }
    throw new Error('no seed found');
  };

  it('maths: 3 correct answers in a row unlock Chrome', () => {
    const sim = withChallenge('maths');
    for (let i = 0; i < 3; i++) {
      expect(sim.state.break).not.toBeNull();
      sim.send({ type: 'skip_answer', value: (sim.state.break!.skip as MathsChallenge).answer });
    }
    expect(sim.state.break).toBeNull();
    expect(sim.state.outcome?.kind).toBe('skipped');
    expect(sim.effects).toContainEqual({ type: 'unlock' });
  });

  it('maths: one wrong answer restarts the series', () => {
    const sim = withChallenge('maths');
    const c = () => sim.state.break!.skip as MathsChallenge;
    sim.send({ type: 'skip_answer', value: c().answer });
    sim.send({ type: 'skip_answer', value: c().answer });
    expect(c().streak).toBe(2);
    sim.send({ type: 'skip_answer', value: c().answer + 1 });
    expect(c()).toMatchObject({ streak: 0, wrong: true });
    sim.send({ type: 'skip_retry' });
    expect(c().wrong).toBe(false);
    for (let i = 0; i < 3; i++) sim.send({ type: 'skip_answer', value: c().answer });
    expect(sim.state.break).toBeNull();
  });

  it('sentence: must match exactly, capitals and punctuation included', () => {
    const sim = withChallenge('type');
    const c = sim.state.break!.skip!;
    if (c.kind !== 'type') throw new Error();
    const sentence = SENTENCES[c.sentences[0]!]!;
    sim.send({ type: 'skip_sentence', text: sentence.toLowerCase() });
    expect(sim.state.break).not.toBeNull();
    sim.send({ type: 'skip_sentence', text: sentence });
    expect(sim.state.break).toBeNull();
  });

  it('second skip of the day: 5 maths answers, or two different sentences', () => {
    const maths = withChallenge('maths', 1);
    expect(maths.state.break!.skip).toMatchObject({ need: 5 });
    const type = withChallenge('type', 1);
    const c = type.state.break!.skip!;
    if (c.kind !== 'type') throw new Error();
    expect(c.sentences).toHaveLength(2);
    expect(c.sentences[0]).not.toBe(c.sentences[1]);
  });

  it('after a skip the battery stays empty and the next prompt comes one interval later', () => {
    const sim = working();
    sim.wait(60);
    sim.wait(3);
    sim.passSkip();
    expect(sim.state.skipsToday).toBe(1);
    expect(batteryLevel(sim.state, sim.now)).toBe(0);
    expect(sim.state.dueAt).toBe(sim.now + 60 * MIN);
    expect(newTabView(sim.state, sim.now)).toMatchObject({ mode: 'skipped', nextInMs: 60 * MIN, seatedMs: 63 * MIN });
    sim.wait(55);
    expect(sim.notified('headsup')).toBe(2);
    sim.wait(5);
    expect(sim.state.break?.phase).toBe('prompt');
    expect(sim.notified('break')).toBe(2);
  });

  it('"Fine, I\'ll do the mission" closes the challenge and keeps the break', () => {
    const sim = working();
    sim.wait(60);
    sim.send({ type: 'skip_open' });
    sim.send({ type: 'skip_cancel' });
    expect(sim.state.break).toMatchObject({ phase: 'prompt', skip: null });
  });

  it('can be used during a mission', () => {
    const sim = working();
    sim.wait(60);
    sim.send({ type: 'start_mission' });
    sim.passSkip();
    expect(sim.state.break).toBeNull();
    expect(sim.state.outcome?.kind).toBe('skipped');
  });
});

describe('showing up', () => {
  it('opens micro.breaks on every Chrome start', () => {
    const sim = working();
    expect(sim.send({ type: 'startup' })).toContainEqual({ type: 'open_home' });
    sim.wait(1);
    expect(sim.send({ type: 'startup' })).toContainEqual({ type: 'open_home' });
  });

  it('opens micro.breaks at the first unlock of the day inside working hours, once', () => {
    const sim = new Sim(at(8, 0));
    sim.send({ type: 'idle', state: 'locked' });
    sim.to(at(8, 30));
    expect(sim.send({ type: 'idle', state: 'active' })).not.toContainEqual({ type: 'open_home' });
    sim.send({ type: 'idle', state: 'locked' });
    sim.to(at(9, 10));
    expect(sim.send({ type: 'idle', state: 'active' })).toContainEqual({ type: 'open_home' });
    sim.send({ type: 'idle', state: 'locked' });
    sim.wait(2);
    expect(sim.send({ type: 'idle', state: 'active' })).not.toContainEqual({ type: 'open_home' });
  });

  it('does nothing before setup is done', () => {
    let state = initialState(at(9, 0), 1);
    for (let i = 1; i <= 120; i++) state = step(state, { type: 'tick' }, at(9, 0) + i * MIN).state;
    expect(state.seatedSince).toBeNull();
    expect(state.break).toBeNull();
    expect(newTabView(state, at(11, 0)).mode).toBe('setup');
  });

  it('does not mutate the state it is given', () => {
    const state = initialState(at(9, 0), 1);
    const frozen = structuredClone(state);
    step(state, { type: 'setup_done' }, at(9, 1));
    expect(state).toEqual(frozen);
  });
});
