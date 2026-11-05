import type { ToolbarState, ToolbarView } from '@/engine';
import { tsAt } from '@/engine/time';

/**
 * Test mode only: every toolbar state with the numbers from the design, to check the icon, the
 * tooltip and the popup without waiting. Forced with the `devToolbarState` storage key.
 */
export const FORCE_KEY = 'devToolbarState';

export const SAMPLE_STATES: { state: ToolbarState; label: string }[] = [
  { state: 'first_run', label: 'First run' },
  { state: 'seated', label: 'Next break' },
  { state: 'last_five', label: 'Last 5 minutes' },
  { state: 'meeting', label: 'In a meeting' },
  { state: 'held', label: 'Break waiting for a meeting' },
  { state: 'skipped', label: 'Break skipped' },
  { state: 'due', label: 'Break due' },
  { state: 'mission', label: 'Mission running, popup opened' },
  { state: 'gap', label: 'Chrome was closed' },
  { state: 'lunch', label: 'Lunch' },
  { state: 'before', label: 'Before working hours' },
  { state: 'done', label: 'Done for today' },
  { state: 'weekend', label: 'Weekend' },
];

const MIN = 60_000;

export function sampleView(state: ToolbarState, now: number): ToolbarView {
  const at = (h: number, m: number) => tsAt(now, h * 60 + m);
  const base: ToolbarView = {
    state,
    level: 100,
    tone: 'level',
    pulse: false,
    nextInMs: 23 * MIN,
    seatedMs: 42 * MIN,
    dueAt: null,
    meetingUntil: null,
    gapMs: 0,
    firstBreakAt: null,
    mission: null,
  };
  switch (state) {
    case 'first_run':
      return { ...base, tone: 'green', firstBreakAt: at(10, 12) };
    case 'seated':
      return { ...base, level: 38 };
    case 'last_five':
      return { ...base, level: 7, nextInMs: 4 * MIN, seatedMs: 56 * MIN, pulse: true };
    case 'meeting':
      return { ...base, level: 55, meetingUntil: at(11, 30) };
    case 'held':
      return { ...base, level: 0, dueAt: at(11, 5), meetingUntil: at(11, 30) };
    case 'skipped':
      return { ...base, level: 0, nextInMs: 52 * MIN, seatedMs: 68 * MIN };
    case 'due':
      return { ...base, level: 0 };
    case 'mission':
      return { ...base, tone: 'green', level: 36, mission: { remainingMs: 192_000, durationMs: 300_000, running: false, video: false } };
    case 'gap':
      return { ...base, level: 45, gapMs: 40 * MIN };
    case 'lunch':
      return { ...base, tone: 'green' };
    case 'before':
    case 'done':
    case 'weekend':
      return { ...base, tone: 'grey' };
  }
}
