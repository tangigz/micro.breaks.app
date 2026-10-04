export type IdleState = 'active' | 'idle' | 'locked';

/** Times of day are minutes since local midnight. */
export interface Settings {
  intervalMin: number;
  dayStart: number;
  dayEnd: number;
  days: 'every' | 'weekdays';
  lunchStart: number;
  lunchEnd: number;
  calendar: boolean;
  theme: 'dark' | 'light';
  missionLengthMin: number;
  headsUpMin: number;
  awayBreakMin: number;
}

export interface MathsChallenge {
  kind: 'maths';
  need: number;
  streak: number;
  question: string;
  answer: number;
  wrong: boolean;
}

export interface TypeChallenge {
  kind: 'type';
  /** Indexes into SENTENCES, in the order they must be typed. */
  sentences: number[];
  done: number;
}

export type Challenge = MathsChallenge | TypeChallenge;

export interface Break {
  phase: 'prompt' | 'mission';
  missionId: string;
  switched: boolean;
  /** Started with "Start a break now": free to cancel until the mission starts. */
  voluntary: boolean;
  openedAt: number;
  videoIndex: number | null;
  durationMs: number;
  remainingMs: number;
  /** Set while the mission timer runs, i.e. while the user is away. */
  runningSince: number | null;
  lastActivityAt: number;
  skip: Challenge | null;
}

export interface Outcome {
  kind: 'mission' | 'away' | 'gap' | 'skipped';
  at: number;
}

export interface State {
  settings: Settings;
  setupDone: boolean;
  seed: number;
  /** Local day being tracked, YYYY-MM-DD. */
  day: string | null;
  dayStarted: boolean;
  dayEnded: boolean;
  homeOpened: boolean;
  idle: IdleState;
  awaySince: number | null;
  /** When the seated timer last restarted from zero. Null while not tracking. */
  seatedSince: number | null;
  dueAt: number | null;
  headsUpFor: number | null;
  heldSince: number | null;
  meetingUntil: number | null;
  break: Break | null;
  deck: string[];
  lastMissionId: string | null;
  videoCursor: Record<string, number>;
  skipsToday: number;
  lastSentence: number | null;
  lastSeenAt: number;
  gap: { since: number; until: number } | null;
  /** What just ended, shown once ("Recharged.", "Skipped."). */
  outcome: Outcome | null;
}

export type Input =
  | { type: 'tick' }
  | { type: 'startup' }
  | { type: 'idle'; state: IdleState; idleForMs?: number }
  | { type: 'setup_done' }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'calendar'; busyUntil: number | null }
  | { type: 'gap_answer'; moved: boolean }
  | { type: 'start_break_now' }
  | { type: 'cancel_break' }
  | { type: 'switch_mission' }
  | { type: 'start_mission'; videoDurationMs?: number }
  | { type: 'skip_open' }
  | { type: 'skip_cancel' }
  | { type: 'skip_answer'; value: number }
  | { type: 'skip_retry' }
  | { type: 'skip_sentence'; text: string }
  | { type: 'outcome_seen' };

export type NotificationKind = 'headsup' | 'break' | 'mission_done';

export type EventType =
  | 'day_start'
  | 'day_end'
  | 'lunch'
  | 'chrome_gap'
  | 'gap_answer'
  | 'headsup_sent'
  | 'prompt_shown'
  | 'prompt_held'
  | 'prompt_dismissed'
  | 'mission_switched'
  | 'mission_started'
  | 'mission_paused'
  | 'mission_completed'
  | 'skip_challenge_shown'
  | 'skip_passed'
  | 'away_break'
  | 'setting_changed';

export type Effect =
  | { type: 'notify'; kind: NotificationKind; seatedMin?: number }
  | { type: 'clear_notification'; kind: NotificationKind }
  | { type: 'open_prompt' }
  | { type: 'open_home' }
  | { type: 'unlock' }
  | { type: 'log'; event: EventType; payload?: Record<string, unknown> };

export interface StepResult {
  state: State;
  effects: Effect[];
}
