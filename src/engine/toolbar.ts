import { tsAt } from './time';
import type { State } from './types';
import { missionView, newTabView } from './view';

/**
 * What the toolbar icon, its tooltip and the popup show. Built on the new tab's view, so the
 * timing rules live in one place; this only picks which of the toolbar's states applies.
 */
export type ToolbarState =
  | 'first_run'
  | 'seated'
  | 'last_five'
  | 'meeting'
  | 'held'
  | 'skipped'
  | 'due'
  | 'mission'
  | 'gap'
  | 'lunch'
  | 'before'
  | 'done'
  | 'weekend';

export interface ToolbarView {
  state: ToolbarState;
  /** Battery level, 0–100. */
  level: number;
  /** How the battery is coloured: by its level, green (full of charge or recharging), or grey (not tracking). */
  tone: 'level' | 'green' | 'grey';
  /** Last minutes before the break: the icon's glow beats. */
  pulse: boolean;
  nextInMs: number;
  seatedMs: number;
  dueAt: number | null;
  meetingUntil: number | null;
  gapMs: number;
  /** First run: when the first break is expected. */
  firstBreakAt: number | null;
  /** A mission: time left, and whether its timer runs right now. */
  mission: { remainingMs: number; durationMs: number; running: boolean; video: boolean } | null;
}

/** The last minutes before a break, when the icon pulses: the same moment as the heads-up. */
export const lastMinutes = (s: State) => s.settings.headsUpMin;

export function toolbarView(s: State, now: number): ToolbarView {
  const v = newTabView(s, now);
  const interval = s.settings.intervalMin * 60_000;
  const base = {
    level: v.level,
    tone: 'level' as const,
    pulse: false,
    nextInMs: v.nextInMs,
    seatedMs: v.seatedMs,
    dueAt: v.dueAt,
    meetingUntil: v.meetingUntil,
    gapMs: v.gapMs,
    firstBreakAt: null,
    mission: null,
  };

  // Chrome was closed: the question comes first, even over a break it made due
  if (v.mode === 'gap') return { ...base, state: 'gap' };

  // A break is open: Chrome is locked onto it
  if (s.break) {
    const m = missionView(s, now);
    if (!m) return { ...base, state: 'due', level: 0 };
    // The battery refills as the mission runs
    const done = m.durationMs > 0 ? 100 * (1 - m.remainingMs / m.durationMs) : 0;
    return {
      ...base,
      state: 'mission',
      level: done,
      tone: 'green',
      mission: { remainingMs: m.remainingMs, durationMs: m.durationMs, running: m.running, video: m.video },
    };
  }

  // From install until the first break prompt
  if (!s.firstPromptShown) {
    const dayStart = tsAt(now, s.settings.dayStart);
    const firstBreakAt = s.dueAt ?? Math.max(now, dayStart) + interval;
    return { ...base, state: 'first_run', level: 100, tone: 'green', firstBreakAt };
  }

  const last = s.dueAt != null && v.nextInMs <= lastMinutes(s) * 60_000;
  switch (v.mode) {
    case 'weekend':
    case 'before':
    case 'done':
      return { ...base, state: v.mode, level: 100, tone: 'grey' };
    case 'lunch':
      return { ...base, state: 'lunch', level: 100, tone: 'green' };
    case 'held':
      return { ...base, state: 'held', level: 0 };
    case 'skipped':
      return { ...base, state: 'skipped', level: 0, pulse: last };
    case 'meeting':
      return { ...base, state: 'meeting' };
    default:
      return { ...base, state: last ? 'last_five' : 'seated', pulse: last };
  }
}
