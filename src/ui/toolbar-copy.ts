import type { Settings, ToolbarView } from '@/engine';
import { clock, duration, nextDay, timeAt, timeOfDay, weekday } from './format';

/** Minutes left, rounded up: "23 min" until the prompt opens, never "0 min". */
export const minutesLeft = (ms: number) => `${Math.max(1, Math.ceil(ms / 60_000))} min`;

/** The tooltip on the toolbar icon. */
export function tooltip(view: ToolbarView, settings: Settings): string {
  const text = ((): string => {
    switch (view.state) {
      case 'first_run':
        return view.firstBreakAt != null ? `First break at ${timeAt(view.firstBreakAt)}` : 'Welcome';
      case 'seated':
      case 'last_five':
        return `Next break in ${minutesLeft(view.nextInMs)}`;
      case 'skipped':
        return `Break skipped, next break in ${minutesLeft(view.nextInMs)}`;
      case 'meeting':
        return `In a meeting until ${timeAt(view.meetingUntil!)}`;
      case 'held':
        return `Break waiting for your meeting, until ${timeAt(view.meetingUntil!)}`;
      case 'due':
        return 'Break due, Chrome is locked';
      case 'mission': {
        const left = `${clock(view.mission!.remainingMs)} left`;
        return view.mission!.running ? `Mission, ${left}` : `Mission paused, ${left}`;
      }
      case 'gap':
        return 'Chrome was closed. Did you step away?';
      case 'lunch':
        return `Lunch until ${timeOfDay(settings.lunchEnd)}`;
      case 'before':
        return `Your day starts at ${timeOfDay(settings.dayStart)}`;
      case 'done':
        return 'Done for today';
      case 'weekend':
        return 'Weekend';
    }
  })();
  return `micro.breaks · ${text}`;
}

export type Tone = 'ink' | 'neg' | 'att';
export type PopupAction = 'start' | 'mission' | 'how' | 'gap';

export interface PopupCopy {
  eyebrow: string;
  eyebrowTone: Tone;
  headline: string;
  /** The minutes headline is set bigger than the others. */
  big: boolean;
  /** The line under the status; `strong` is set in ink inside it. */
  line: { before?: string; strong?: string; after?: string };
  action: PopupAction | null;
}

/** What the popup says in each state. */
export function popupCopy(view: ToolbarView, settings: Settings, now: number): PopupCopy {
  const start = timeOfDay(settings.dayStart);
  const since = { strong: duration(view.seatedMs), after: ' since your last active break' };
  const plain = (before: string) => ({ before });
  switch (view.state) {
    case 'first_run':
      return {
        eyebrow: 'Welcome',
        eyebrowTone: 'ink',
        headline: 'You’re set.',
        big: false,
        line: { before: 'First break at ', strong: timeAt(view.firstBreakAt ?? now), after: '.' },
        action: 'how',
      };
    case 'seated':
    case 'last_five':
      return { eyebrow: 'Next break in', eyebrowTone: 'ink', headline: minutesLeft(view.nextInMs), big: true, line: since, action: 'start' };
    case 'skipped':
      return {
        eyebrow: 'Skipped · Next break in',
        eyebrowTone: 'neg',
        headline: minutesLeft(view.nextInMs),
        big: true,
        line: since,
        action: 'start',
      };
    case 'meeting':
      return {
        eyebrow: 'In a meeting',
        eyebrowTone: 'ink',
        headline: `Until ${timeAt(view.meetingUntil!)}`,
        big: false,
        line: plain('Your break waits until it ends.'),
        action: 'start',
      };
    case 'held':
      return {
        eyebrow: `Break due at ${timeAt(view.dueAt!)}`,
        eyebrowTone: 'att',
        headline: `Until ${timeAt(view.meetingUntil!)}`,
        big: false,
        line: plain('Your break is waiting. It opens when the meeting ends.'),
        action: 'start',
      };
    case 'due':
      return {
        eyebrow: 'Break due',
        eyebrowTone: 'neg',
        headline: 'Time to move.',
        big: false,
        line: plain('Chrome is locked until you move.'),
        action: 'mission',
      };
    case 'mission': {
      const m = view.mission!;
      return {
        eyebrow: m.running ? 'Mission' : 'Mission · Paused',
        eyebrowTone: m.running ? 'ink' : 'att',
        headline: `${clock(m.remainingMs)} left`,
        big: false,
        line: plain(m.running ? (m.video ? 'Your routine is playing.' : 'Your timer is running.') : 'Step away to continue.'),
        action: 'mission',
      };
    }
    case 'gap':
      return {
        eyebrow: `Chrome closed · ${duration(view.gapMs)}`,
        eyebrowTone: 'att',
        headline: 'Did you step away?',
        big: false,
        line: plain('No answer counts as seated.'),
        action: 'gap',
      };
    case 'lunch':
      return {
        eyebrow: 'Lunch',
        eyebrowTone: 'ink',
        headline: `Until ${timeOfDay(settings.lunchEnd)}`,
        big: false,
        line: plain('Tracking paused. Your battery will be full.'),
        action: null,
      };
    case 'before':
      return {
        eyebrow: 'Before working hours',
        eyebrowTone: 'ink',
        headline: start,
        big: true,
        line: plain(`Your day starts at ${start}, at your first activity.`),
        action: null,
      };
    case 'done':
      return {
        eyebrow: `${weekday(now)} · ${timeOfDay(settings.dayEnd)}`,
        eyebrowTone: 'ink',
        headline: 'Done for today.',
        big: false,
        line: plain(`See you ${nextDay(settings, now)} at ${start}.`),
        action: null,
      };
    case 'weekend':
      return {
        eyebrow: weekday(now),
        eyebrowTone: 'ink',
        headline: 'Weekend.',
        big: false,
        line: plain(`See you ${nextDay(settings, now)} at ${start}.`),
        action: null,
      };
  }
}
