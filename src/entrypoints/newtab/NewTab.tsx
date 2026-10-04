import type { ReactNode } from 'react';
import { browser } from 'wxt/browser';
import calendar from '@/assets/emoji/calendar.png';
import { send } from '@/data/client';
import { type NewTabView, newTabView, type State } from '@/engine';
import { isWorkingDay } from '@/engine/time';
import { Battery, Halo } from '@/ui/Battery';
import { clock, duration, timeAt, timeOfDay, weekday } from '@/ui/format';

const DAY = 24 * 60 * 60_000;

const eyebrow = 'text-[13px] leading-4 font-medium tracking-[0.08em] uppercase';
const section = 'text-[22px] leading-[28px] font-semibold tracking-[-0.01em] text-ink-2';

function Countdown({ label, ms, since }: { label: ReactNode; ms: number; since: ReactNode }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className={`${eyebrow} text-ink-2`}>{label}</div>
        <div role="timer" aria-live="off" className="text-[160px] leading-[144px] font-bold tracking-[-0.05em]">
          {clock(ms)}
        </div>
      </div>
      <div className={section}>{since} since your last active break</div>
    </div>
  );
}

function Quiet({ label, title, sub, big, attention }: { label: string; title: string; sub: string; big?: boolean; attention?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div className={`${eyebrow} ${attention ? 'text-att' : 'text-ink-2'}`}>{label}</div>
      <h1
        className={`m-0 font-bold tracking-[-0.045em] ${big ? 'text-[160px] leading-[144px]' : 'text-[104px] leading-[100px]'}`}
      >
        {title}
      </h1>
      <div className={`${section} mt-3 max-w-[540px] leading-[30px]`}>{sub}</div>
    </div>
  );
}

/** The next working day by name, or "tomorrow". */
function nextDay(state: State, now: number): string {
  for (let i = 1; i <= 7; i++) {
    if (isWorkingDay(state.settings, now + i * DAY)) return i === 1 ? 'tomorrow' : weekday(now + i * DAY);
  }
  return 'tomorrow';
}

function Info({ state, now, view }: { state: State; now: number; view: NewTabView }) {
  const { settings } = state;
  const start = timeOfDay(settings.dayStart);

  switch (view.mode) {
    case 'setup':
      return (
        <Quiet
          label="Welcome"
          title="Stay charged all day."
          sub="We help you build regular, short active breaks into your workday."
        />
      );
    case 'before':
      return (
        <Quiet label="Before working hours" title={start} big sub={`Your day starts at ${start}, at your first activity.`} />
      );
    case 'lunch':
      return (
        <Quiet
          label={`Lunch · ${timeOfDay(settings.lunchStart)}–${timeOfDay(settings.lunchEnd)}`}
          title="Lunch."
          sub={`Tracking paused until ${timeOfDay(settings.lunchEnd)}. Your battery will be full.`}
        />
      );
    case 'held':
      return (
        <Quiet
          attention
          label={`Break due at ${timeAt(view.dueAt!)}`}
          title="In a meeting."
          sub={`Your break is waiting. It opens at ${timeAt(view.meetingUntil!)}, when the meeting ends.`}
        />
      );
    case 'done':
      return (
        <Quiet
          label={`${weekday(now)} · ${timeOfDay(settings.dayEnd)}`}
          title="Done for today."
          sub={`See you ${nextDay(state, now)}.`}
        />
      );
    case 'weekend':
      return <Quiet label={weekday(now)} title="Weekend." sub={`See you ${nextDay(state, now)} at ${start}.`} />;
    case 'skipped':
      return (
        <Countdown
          label={
            <>
              <span className="text-neg">Break skipped</span> · Next break in
            </>
          }
          ms={view.nextInMs}
          since={<span className="text-neg">{duration(view.seatedMs)}</span>}
        />
      );
    default:
      return (
        <div className="flex flex-col gap-8">
          {view.mode === 'meeting' && (
            <div
              role="status"
              className="inline-flex h-11 items-center gap-2.5 self-start rounded-full bg-raised pr-[18px] pl-2.5 text-[15px] leading-5 whitespace-nowrap"
            >
              <img src={calendar} alt="" className="size-7" />
              <span>
                <b className="font-semibold">In a meeting until {timeAt(view.meetingUntil!)}.</b>{' '}
                <span className="text-ink-2">Prompts wait.</span>
              </span>
            </div>
          )}
          <Countdown
            label="Next break in"
            ms={view.nextInMs}
            since={<span className="text-ink">{duration(view.seatedMs)}</span>}
          />
        </div>
      );
  }
}

function Actions({ state, view }: { state: State; view: NewTabView }) {
  const { settings } = state;
  const { mode } = view;
  if (mode === 'done' || mode === 'weekend' || mode === 'setup') return null;
  const hours = `${timeOfDay(settings.dayStart)}–${timeOfDay(settings.dayEnd)}`;
  return (
    <div className="flex items-center gap-3">
      {mode !== 'before' && mode !== 'lunch' && (
        <button
          className="inline-flex h-[52px] cursor-pointer items-center gap-2.5 rounded-full bg-ink px-[26px] text-[15px] font-semibold text-on-ink"
          onClick={() => void send({ type: 'start_break_now' })}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="7 4 19 12 7 20 7 4" />
          </svg>
          Start a break now
        </button>
      )}
      {/* Opens the movement timer once it exists (#5) */}
      <span className="inline-flex h-[52px] items-center gap-2.5 rounded-full border border-line px-[22px] text-[15px] font-medium text-ink-2">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2 2M10 2h4" />
        </svg>
        Every {settings.intervalMin} min · {hours}
      </span>
    </div>
  );
}

/** Chrome was closed: asked once, takes the hero spot until answered. */
function GapQuestion({ view }: { view: NewTabView }) {
  return (
    <div role="dialog" aria-labelledby="gap-question" className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className={`${eyebrow} text-att`}>Chrome was closed for {duration(view.gapMs)}</div>
        <h1 id="gap-question" className="m-0 text-[104px] leading-[100px] font-bold tracking-[-0.045em]">
          Did you step away?
        </h1>
        <div className={section}>Your battery depends on it.</div>
      </div>
      <div className="flex items-center gap-3">
        <button
          className="h-14 cursor-pointer rounded-full bg-ink px-8 text-[17px] font-semibold text-on-ink"
          onClick={() => void send({ type: 'gap_answer', moved: true })}
        >
          Yes, I moved
        </button>
        <button
          className="h-14 cursor-pointer rounded-full bg-pill px-6 text-[15px] font-medium text-ink"
          onClick={() => void send({ type: 'gap_answer', moved: false })}
        >
          No, I kept working
        </button>
      </div>
      <div className="text-[15px] leading-5 text-ink-2">No answer counts as seated.</div>
    </div>
  );
}

/** Notifications blocked: micro.breaks can't reach you outside Chrome. */
export function HealthLine() {
  return (
    <div
      role="status"
      className="absolute bottom-10 left-1/2 flex h-12 -translate-x-1/2 items-center gap-3 rounded-full bg-att-bg pr-2 pl-5 text-[15px] leading-5 whitespace-nowrap"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        className="stroke-att"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5" />
        <path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        <path d="m2 2 20 20" />
      </svg>
      <span>
        <b className="font-semibold">Notifications are off.</b> micro.breaks can't reach you outside Chrome.
      </span>
      <button
        className="h-9 cursor-pointer rounded-full bg-ink px-4 text-[15px] font-semibold text-on-ink"
        onClick={() => void browser.tabs.create({ url: 'chrome://settings/content/notifications' })}
      >
        Turn on
      </button>
    </div>
  );
}

function batteryLabel(view: NewTabView): string {
  switch (view.mode) {
    case 'setup':
    case 'before':
    case 'done':
    case 'weekend':
      return 'Battery idle, not tracking right now';
    case 'lunch':
      return 'Battery recharging during lunch';
    case 'skipped':
      return 'Battery empty, the break was skipped';
    case 'held':
      return 'Battery empty, your break is due';
    default:
      return `Battery at ${Math.round(view.level)} percent until your next break`;
  }
}

export function NewTab({ state, now }: { state: State; now: number }) {
  const view = newTabView(state, now);
  const { mode } = view;
  const idle = mode === 'setup' || mode === 'before' || mode === 'done' || mode === 'weekend';
  const still = idle || mode === 'held' || mode === 'skipped';
  const gap = mode === 'gap';
  const level = idle ? 100 : view.level;

  return (
    <main className="relative grid w-[1120px] grow grid-cols-[420px_minmax(0,1fr)] items-center gap-20 pb-[72px]">
      <Halo level={level} idle={idle} dim={gap} />
      <div className="relative flex justify-center">
        <Battery level={level} idle={idle} still={still} dim={gap} label={batteryLabel(view)} />
      </div>
      <div className="relative">
        {gap ? (
          <GapQuestion view={view} />
        ) : (
          <div className="flex flex-col gap-8">
            <Info state={state} now={now} view={view} />
            <Actions state={state} view={view} />
          </div>
        )}
      </div>
    </main>
  );
}
