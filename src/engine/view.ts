import { inMeeting } from './engine';
import { inLunch, isWorkingDay, MIN, minuteOfDay } from './time';
import type { State } from './types';

/** Level = 100% − time seated ÷ interval. */
export function batteryLevel(s: State, now: number): number {
  if (s.seatedSince == null) return 100;
  const level = 100 - ((now - s.seatedSince) / (s.settings.intervalMin * MIN)) * 100;
  return Math.max(0, Math.min(100, level));
}

export type NewTabMode =
  | 'setup'
  | 'gap'
  | 'weekend'
  | 'before'
  | 'done'
  | 'lunch'
  | 'held'
  | 'skipped'
  | 'meeting'
  | 'normal';

export interface NewTabView {
  mode: NewTabMode;
  level: number;
  /** Time to the next prompt. */
  nextInMs: number;
  /** Time since the last active break. */
  seatedMs: number;
  dueAt: number | null;
  meetingUntil: number | null;
  gapMs: number;
}

export function newTabView(s: State, now: number): NewTabView {
  const { settings } = s;
  const m = minuteOfDay(now);
  const interval = settings.intervalMin * MIN;
  const meeting = inMeeting(s, now);
  const skipped = s.seatedSince != null && s.dueAt != null && s.dueAt > s.seatedSince + interval;

  let mode: NewTabMode = 'normal';
  if (!s.setupDone) mode = 'setup';
  else if (s.gap) mode = 'gap';
  else if (!isWorkingDay(settings, now)) mode = 'weekend';
  else if (m < settings.dayStart) mode = 'before';
  else if (m >= settings.dayEnd) mode = 'done';
  else if (inLunch(settings, now)) mode = 'lunch';
  else if (s.heldSince != null && meeting) mode = 'held';
  else if (skipped) mode = 'skipped';
  else if (meeting) mode = 'meeting';

  return {
    mode,
    level: batteryLevel(s, now),
    nextInMs: s.dueAt != null ? Math.max(0, s.dueAt - now) : interval,
    seatedMs: s.seatedSince != null ? Math.max(0, now - s.seatedSince) : 0,
    dueAt: s.dueAt,
    meetingUntil: meeting ? s.meetingUntil : null,
    gapMs: s.gap ? s.gap.until - s.gap.since : 0,
  };
}

export interface MissionView {
  running: boolean;
  remainingMs: number;
  durationMs: number;
}

export function missionView(s: State, now: number): MissionView | null {
  const b = s.break;
  if (b?.phase !== 'mission') return null;
  const ran = b.runningSince != null ? now - b.runningSince : 0;
  return { running: b.runningSince != null, remainingMs: Math.max(0, b.remainingMs - ran), durationMs: b.durationMs };
}
