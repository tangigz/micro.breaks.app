import { answerMaths, newChallenge, nextQuestion, SENTENCES } from './challenge';
import { draw, mission } from './missions';
import { dayKey, inWindow, MIN, tsAt } from './time';
import type { Break, Effect, EventType, Input, Outcome, Settings, State, StepResult } from './types';

export const DEFAULT_SETTINGS: Settings = {
  intervalMin: 60,
  dayStart: 9 * 60,
  dayEnd: 18 * 60,
  days: 'every',
  lunchStart: 12 * 60 + 30,
  lunchEnd: 13 * 60 + 30,
  calendar: false,
  theme: 'dark',
  missionLengthMin: 5,
  headsUpMin: 5,
  awayBreakMin: 5,
};

export function initialState(now: number, seed: number): State {
  return {
    settings: { ...DEFAULT_SETTINGS },
    setupDone: false,
    seed,
    day: null,
    dayStarted: false,
    dayEnded: false,
    homeOpened: false,
    idle: 'active',
    awaySince: null,
    seatedSince: null,
    dueAt: null,
    headsUpFor: null,
    heldSince: null,
    meetingUntil: null,
    break: null,
    deck: [],
    lastMissionId: null,
    videoCursor: {},
    skipsToday: 0,
    lastSentence: null,
    lastSeenAt: now,
    gap: null,
    outcome: null,
  };
}

export const inMeeting = (s: State, now: number) => s.meetingUntil != null && now < s.meetingUntil;

/** Every product rule, as one pure function. The background feeds it and executes the effects. */
export function step(prev: State, input: Input, now: number): StepResult {
  const s: State = structuredClone(prev);
  const fx: Effect[] = [];
  const log = (event: EventType, payload?: Record<string, unknown>) => fx.push({ type: 'log', event, payload });
  const interval = () => s.settings.intervalMin * MIN;
  const awayBreak = () => s.settings.awayBreakMin * MIN;

  const stopTracking = () => {
    s.seatedSince = null;
    s.dueAt = null;
    s.headsUpFor = null;
    s.heldSince = null;
  };

  const endBreak = () => {
    s.break = null;
    fx.push({ type: 'unlock' }, { type: 'clear_notification', kind: 'break' });
  };

  const dismissPrompt = (reason: string) => {
    if (s.break?.phase !== 'prompt') return;
    endBreak();
    log('prompt_dismissed', { reason });
  };

  /** The battery is full again; the seated timer restarts from zero at the next activity. */
  const recharge = (kind: Outcome['kind']) => {
    stopTracking();
    s.gap = null;
    s.outcome = { kind, at: now };
  };

  const openPrompt = (voluntary: boolean) => {
    s.break = {
      phase: 'prompt',
      missionId: draw(s),
      switched: false,
      voluntary,
      openedAt: now,
      videoIndex: null,
      durationMs: 0,
      remainingMs: 0,
      runningSince: null,
      lastActivityAt: now,
      skip: null,
    };
    s.outcome = null;
    fx.push({ type: 'open_prompt' });
  };

  const passSkip = (b: Break) => {
    log('skip_passed', { missionId: b.missionId, phase: b.phase, voluntary: b.voluntary });
    endBreak();
    if (b.voluntary) return;
    // The battery stays empty. The next prompt comes one interval later.
    s.skipsToday += 1;
    s.dueAt = now + interval();
    s.headsUpFor = null;
    s.outcome = { kind: 'skipped', at: now };
  };

  const completeMission = (m: Break) => {
    log('mission_completed', { missionId: m.missionId, durationMs: m.durationMs, voluntary: m.voluntary });
    endBreak();
    recharge('mission');
    fx.push({ type: 'notify', kind: 'mission_done' });
  };

  /** Back at the keyboard: the mission timer pauses. */
  const onActivity = () => {
    const b = s.break;
    if (!b) return;
    if (b.phase === 'mission' && b.runningSince != null) {
      const ran = now - b.runningSince;
      if (ran >= b.remainingMs) return; // finished while away: settle() completes it
      b.remainingMs -= ran;
      b.runningSince = null;
      log('mission_paused', { remainingMs: b.remainingMs });
    }
    b.lastActivityAt = now;
  };

  /** 5+ min away without a mission running: a coffee, a locked screen, or walking off at the prompt. */
  const settleAway = () => {
    if (s.awaySince == null) return;
    // Idle time during a calendar meeting does not recharge
    if (inMeeting(s, now)) {
      s.awaySince = now;
      return;
    }
    if (now - s.awaySince < awayBreak()) return;
    if (s.break?.phase === 'mission') return;
    if (s.seatedSince == null && !s.break) return;
    log('away_break', { awayMs: now - s.awaySince, atPrompt: !!s.break });
    if (s.break) endBreak();
    recharge('away');
  };

  // --- Time passing: new day, lunch, end of day ---
  const day = dayKey(now);
  if (s.day !== day) {
    s.day = day;
    s.dayStarted = false;
    s.dayEnded = false;
    s.homeOpened = false;
    s.skipsToday = 0;
    s.gap = null;
    stopTracking();
    dismissPrompt('new_day');
  }
  if (s.setupDone) {
    const lunchStart = tsAt(now, s.settings.lunchStart);
    if (s.seatedSince != null && s.seatedSince < lunchStart && now >= lunchStart) {
      log('lunch');
      stopTracking();
      s.gap = null;
      dismissPrompt('lunch');
    }
    if (now >= tsAt(now, s.settings.dayEnd) && s.dayStarted && !s.dayEnded) {
      s.dayEnded = true;
      log('day_end');
      stopTracking();
      s.gap = null;
      dismissPrompt('day_end');
    }
  }

  // --- The input ---
  const b = s.break;
  switch (input.type) {
    case 'tick':
      break;

    case 'startup': {
      const closedFor = now - s.lastSeenAt;
      s.idle = 'active';
      s.awaySince = null;
      onActivity();
      fx.push({ type: 'open_home' });
      if (s.break) fx.push({ type: 'open_prompt' });
      // Under 5 min: counted as seated. 5 min or more: one question on reopening.
      else if (s.setupDone && s.seatedSince != null && closedFor >= awayBreak()) {
        s.gap = { since: s.lastSeenAt, until: now };
        log('chrome_gap', { closedMs: closedFor });
      }
      break;
    }

    case 'idle': {
      const was = s.idle;
      s.idle = input.state;
      if (input.state === 'active') {
        if (was === 'locked' && !s.homeOpened && s.setupDone && inWindow(s.settings, now)) {
          s.homeOpened = true;
          fx.push({ type: 'open_home' });
        }
        onActivity();
        settleAway();
        s.awaySince = null;
      } else {
        // "idle" is reported once the detection interval has passed without input: credit it back
        const since = input.state === 'idle' ? now - (input.idleForMs ?? 0) : now;
        if (s.awaySince == null) s.awaySince = since;
        // Video missions run on the clock, not on being away: the user is watching the screen
        if (b?.phase === 'mission' && b.videoIndex == null && b.runningSince == null) {
          b.runningSince = Math.max(since, b.lastActivityAt);
        }
      }
      break;
    }

    case 'setup_done':
      s.setupDone = true;
      break;

    case 'settings': {
      Object.assign(s.settings, input.patch);
      log('setting_changed', { ...input.patch });
      if (s.seatedSince != null && !inWindow(s.settings, now)) {
        // The new hours, days or lunch exclude right now
        stopTracking();
        dismissPrompt('setting_changed');
      } else if (input.patch.intervalMin != null && s.seatedSince != null) {
        s.dueAt = s.seatedSince + interval();
        s.headsUpFor = null;
      }
      break;
    }

    case 'calendar':
      s.meetingUntil = input.busyUntil;
      break;

    case 'gap_answer':
      if (!s.gap) break;
      log('gap_answer', { moved: input.moved, closedMs: s.gap.until - s.gap.since });
      if (input.moved) recharge('gap');
      s.gap = null;
      break;

    case 'start_break_now':
      if (!b) openPrompt(true);
      break;

    case 'cancel_break':
      if (b?.phase === 'prompt' && b.voluntary) endBreak();
      break;

    case 'switch_mission':
      // Switch swaps the mission once per break
      if (b?.phase === 'prompt' && !b.switched) {
        const from = b.missionId;
        b.missionId = draw(s);
        b.switched = true;
        log('mission_switched', { from, to: b.missionId });
      }
      break;

    case 'start_mission': {
      if (b?.phase !== 'prompt') break;
      const m = mission(b.missionId);
      let duration = s.settings.missionLengthMin * MIN;
      if (m.videos?.length) {
        // One video per break, rotating. The mission lasts the trimmed video.
        const i = (s.videoCursor[m.id] ?? 0) % m.videos.length;
        s.videoCursor[m.id] = i + 1;
        b.videoIndex = i;
        const v = m.videos[i]!;
        if (input.videoDurationMs != null) duration = input.videoDurationMs;
        else if (v.end != null) duration = (v.end - (v.start ?? 0)) * 1000;
        else b.awaitingVideoDuration = true;
      }
      b.phase = 'mission';
      b.startedAt = now;
      b.durationMs = duration;
      b.remainingMs = duration;
      b.runningSince = null;
      b.lastActivityAt = now;
      b.skip = null;
      log('mission_started', { missionId: b.missionId, videoIndex: b.videoIndex, durationMs: duration, voluntary: b.voluntary });
      break;
    }

    case 'video_duration': {
      // The mission lasts the video, minus what the trim leaves out at the start
      if (b?.phase !== 'mission' || !b.awaitingVideoDuration || !(input.ms > 0)) break;
      const start = (mission(b.missionId).videos?.[b.videoIndex ?? 0]?.start ?? 0) * 1000;
      b.durationMs = Math.max(0, input.ms - start);
      b.remainingMs = b.durationMs;
      b.awaitingVideoDuration = false;
      break;
    }

    case 'video_done':
      // "I've done the routine": accepted once the video's length has passed since Start mission
      if (b?.phase === 'mission' && b.videoIndex != null && videoTimeLeft(b, now) <= 0) {
        completeMission(b);
      }
      break;

    case 'skip_open':
      if (b && !b.skip) {
        b.skip = newChallenge(s);
        log('skip_challenge_shown', { kind: b.skip.kind, second: s.skipsToday >= 1 });
      }
      break;

    case 'skip_cancel':
      if (b) b.skip = null;
      break;

    case 'skip_answer':
      if (b?.skip?.kind === 'maths' && answerMaths(s, b.skip, input.value)) passSkip(b);
      break;

    case 'skip_retry':
      if (b?.skip?.kind === 'maths' && b.skip.wrong) nextQuestion(s, b.skip);
      break;

    case 'skip_sentence': {
      const c = b?.skip;
      if (!b || c?.kind !== 'type') break;
      // Capitals and punctuation must match
      if (input.text !== SENTENCES[c.sentences[c.done]!]) break;
      c.done += 1;
      if (c.done >= c.sentences.length) passSkip(b);
      break;
    }

    case 'outcome_seen':
      s.outcome = null;
      break;
  }

  // --- What follows from the new state ---
  if (s.setupDone) {
    const m = s.break;
    if (m?.phase === 'mission' && m.runningSince != null && now - m.runningSince >= m.remainingMs) completeMission(m);

    settleAway();

    // The first keyboard or mouse activity inside working hours starts the seated timer
    if (s.seatedSince == null && s.idle === 'active' && s.break?.phase !== 'mission' && inWindow(s.settings, now)) {
      s.seatedSince = now;
      s.dueAt = now + interval();
      if (!s.dayStarted) {
        s.dayStarted = true;
        log('day_start');
      }
    }

    if (s.dueAt != null) {
      const due = now >= s.dueAt;
      const held = inMeeting(s, now);
      if (s.break) {
        // A break started early becomes the real one once it is due
        if (due && s.break.voluntary) s.break.voluntary = false;
      } else if (due && held) {
        // A break due in a meeting waits until it ends
        if (s.heldSince == null) {
          s.heldSince = now;
          log('prompt_held', { until: s.meetingUntil });
        }
      } else if (due) {
        s.heldSince = null;
        const seatedMin = s.seatedSince != null ? Math.floor((now - s.seatedSince) / MIN) : undefined;
        openPrompt(false);
        fx.push({ type: 'clear_notification', kind: 'headsup' }, { type: 'notify', kind: 'break', seatedMin });
        log('prompt_shown', { missionId: s.break!.missionId, seatedMin });
      } else if (!held && now >= s.dueAt - s.settings.headsUpMin * MIN && s.headsUpFor !== s.dueAt) {
        s.headsUpFor = s.dueAt;
        fx.push({ type: 'notify', kind: 'headsup' });
        log('headsup_sent');
      }
    }
  }

  s.lastSeenAt = now;
  return { state: s, effects: fx };
}

/** Time left on a video mission: its length, counted from Start mission. */
export function videoTimeLeft(b: Break, now: number): number {
  return Math.max(0, b.durationMs - (now - (b.startedAt ?? b.openedAt)));
}

/** Chrome is locked onto the mission tab from the prompt until the mission is completed or skipped. */
export const isLocked = (s: State) => s.break != null;

/** When the engine next needs a tick, if sooner than the 1-min alarm: the end of a running mission. */
export function nextWake(s: State): number | null {
  const b = s.break;
  return b?.phase === 'mission' && b.runningSince != null ? b.runningSince + b.remainingMs : null;
}
