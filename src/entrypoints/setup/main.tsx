import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import brain from '@/assets/emoji/brain.png';
import biceps from '@/assets/emoji/flexed-biceps.png';
import voltage from '@/assets/emoji/high-voltage.png';
import { PRIVACY_URL } from '@/config';
import { send, setCalendar, track, useEngine } from '@/data/client';
import { useStored } from '@/data/stored';
import type { Settings } from '@/engine';
import { Battery, Halo } from '@/ui/Battery';
import { DevBar } from '@/ui/DevBar';
import { Frame } from '@/ui/Frame';
import { timeOfDay } from '@/ui/format';
import { Header } from '@/ui/Header';
import { TimerSentence } from '@/ui/TimerSentence';
import { applySavedTheme, applyTheme } from '@/ui/theme';
import { mount } from '@/ui/mount';
import '@/ui/tokens.css';
import { askForNotifications, notificationsAllowed } from '@/data/notifications';

applySavedTheme();

/** Where the welcome flow stands. Kept in storage so a closed tab resumes where it left off. */
interface Progress {
  started: boolean;
  timer: boolean;
  /** Google Calendar: 0 to do · 1 connected · 2 "Not now" */
  calendar: 0 | 1 | 2;
  /** Notifications: 0 to do · 1 allowed · 2 "Not now" */
  notify: 0 | 1 | 2;
}

/** The setup talks about system settings, which differ by platform. */
const PLATFORM = /Mac/i.test(navigator.platform) ? 'mac' : /Win/i.test(navigator.platform) ? 'windows' : 'other';

/** Notifications must stay on screen: where to set that, by platform. */
const STAY_ON_SCREEN = {
  mac: 'Then set Chrome to Alerts in System Settings › Notifications, so they stay on screen.',
  windows: 'Then check that Google Chrome is on in Settings › System › Notifications.',
  other: '',
}[PLATFORM];

const START: Progress = { started: false, timer: false, calendar: 0, notify: 0 };

type Action = { label: string; run: () => void } | { label: string; href: string };

interface Step {
  head: string;
  /** Shown next to the title: the optional steps are recommended. */
  tag?: string;
  /** One line once the step is done. */
  summary: string;
  /** Step 1 shows the editable sentence instead. */
  desc?: string;
  /** A smaller line under the text. */
  note?: string;
  main: Action;
  more: Action[];
  error?: string;
}

function timerLine(s: Settings): string {
  const days = s.days === 'every' ? 'every day' : 'on weekdays';
  return `Every ${s.intervalMin} min, ${timeOfDay(s.dayStart)}–${timeOfDay(s.dayEnd)}, ${days}.`;
}

function Pill({ action, primary, large, disabled }: { action: Action; primary?: boolean; large?: boolean; disabled?: boolean }) {
  const look = primary ? 'bg-ink text-on-ink' : 'bg-pill text-ink';
  const size = large ? (primary ? 'h-14 px-9 text-[17px]' : 'h-14 px-6 text-[15px]') : 'h-12 px-6 text-[15px]';
  const className = `inline-flex cursor-pointer items-center rounded-full font-semibold whitespace-nowrap no-underline ${look} ${size}`;
  return 'href' in action ? (
    <a href={action.href} className={className}>
      {action.label}
    </a>
  ) : (
    <button className={`${className} disabled:cursor-wait disabled:opacity-60`} disabled={disabled} onClick={action.run}>
      {action.label}
    </button>
  );
}

function BatteryShape({ label, children, glow }: { label: string; children: React.ReactNode; glow?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="h-4 w-[72px] rounded-t-[10px] bg-ink" />
      <div
        role="img"
        aria-label={label}
        className="flex h-[440px] w-[220px] flex-col justify-end rounded-[48px] border-[6px] border-ink p-3"
        style={glow ? { boxShadow: '0 0 40px 0 rgba(111,207,122,.22)' } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

const BENEFITS = [
  { img: voltage, tile: 'bg-tile-peach', title: 'More energy', text: 'No afternoon crash.' },
  { img: brain, tile: 'bg-tile-lilac', title: 'Sharper focus', text: 'Until the work is done.' },
  { img: biceps, tile: 'bg-tile-green', title: 'A looser body', text: 'No stiff neck or lower back.' },
];

function Setup() {
  const engine = useEngine();
  const [saved, setProgress] = useStored<Progress>('setup', START);
  // Saved by an earlier version: its steps were different, only the timer carries over
  const progress = saved && { ...START, started: saved.started, timer: saved.timer, calendar: saved.calendar ?? 0, notify: saved.notify ?? 0 };
  const [connecting, setConnecting] = useState(false);
  const [view, setView] = useStored<number | null>('setupView', null);
  const [calendarError, setCalendarError] = useState<string>();
  const [email, setEmail] = useState('');
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const theme = engine?.state.settings.theme;

  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);

  // ?step=2 opens that step directly
  useEffect(() => {
    const step = Number(new URLSearchParams(location.search).get('step'));
    if (progress && step >= 1 && step <= 3) {
      setProgress({ ...progress, started: true });
      setView(step - 1);
      history.replaceState(null, '', location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress == null]);

  if (!engine || !progress) return null;
  const { state } = engine;
  const p = progress;

  /** Records progress and moves to the first step still to do. */
  const advance = (patch: Partial<Progress>) => {
    setProgress({ ...p, ...patch });
    setView(null);
  };
  /** A step is completed. Counted once, even if the step is reopened and confirmed again. */
  const completeStep = (step: number, patch: Partial<Progress>, skipped = false) => {
    if (!done[step - 1]) track('setup_step_done', { step, ...(skipped ? { skipped } : {}) });
    advance(patch);
  };
  /** Records progress without leaving the step. */
  const stay = (patch: Partial<Progress>) => setProgress({ ...p, ...patch });

  // Connected from the settings too: the calendar step reads the setting itself
  const calendarOn = state.settings.calendar;
  const done = [p.timer, calendarOn || p.calendar === 2, p.notify > 0];
  const count = done.filter(Boolean).length;
  const first = done.indexOf(false);
  const welcome = !p.started && !state.setupDone;
  /** Closes a finished step and moves to the first one still to do. */
  const next: Action = { label: 'Continue', run: () => setView(null) };

  const allow = async () => {
    // Chrome's own prompt, right after the explanation above. Called first, while the click counts.
    if (!(await askForNotifications())) return;
    if (await notificationsAllowed()) completeStep(3, { notify: 1 });
    // Granted to micro.breaks but blocked in Chrome's settings
    else await browser.tabs.create({ url: 'chrome://settings/content/notifications' });
  };
  const connect = async () => {
    setConnecting(true);
    const error = await setCalendar(true);
    setConnecting(false);
    setCalendarError(error);
    if (!error) completeStep(2, { calendar: 1 });
  };

  const steps: Step[] = [
    {
      head: 'Set your movement timer',
      summary: timerLine(state.settings),
      main: { label: 'Continue', run: () => completeStep(1, { timer: true }) },
      more: [],
    },
    {
      head: 'Protect your meetings',
      tag: 'Recommended',
      summary: calendarOn
        ? 'Connected. No breaks during your meetings.'
        : 'Not connected. You can connect it later from your movement timer.',
      desc: 'Connect Google Calendar and micro.breaks will never lock Chrome during a meeting. Your break waits until the meeting ends.',
      note: 'Read-only, busy times only: no titles, no attendees.',
      main: calendarOn ? next : { label: connecting ? 'Connecting…' : 'Connect Google Calendar', run: () => void connect() },
      more: calendarOn || p.calendar === 2 ? [] : [{ label: 'Not now', run: () => completeStep(2, { calendar: 2 }, true) }],
      error: calendarError,
    },
    {
      head: 'Get a heads-up before each break',
      tag: 'Recommended',
      summary: p.notify === 1 ? 'On. A heads-up 5 min before each break.' : 'Off for now. You can turn them on from the new tab.',
      desc: "Allow notifications to know 5 min before each break, even when you're working in another app.",
      note: STAY_ON_SCREEN || undefined,
      main: p.notify === 1 ? next : { label: 'Allow', run: () => void allow() },
      // Declining Chrome's prompt must not block the welcome flow: "Not now" finishes the step without them
      more: p.notify === 0 ? [{ label: 'Not now', run: () => completeStep(3, { notify: 2 }, true) }] : [],
    },
  ];
  const start = async () => {
    const { intervalMin, dayStart, dayEnd, days, lunchStart, lunchEnd, calendar } = state.settings;
    track('setup_completed', { intervalMin, dayStart, dayEnd, days, lunchStart, lunchEnd, calendar });
    await send({ type: 'setup_done' });
    location.href = '/newtab.html';
  };

  // The battery charges with the setup: coral at 0 of 3, amber, green at 3 of 3
  const level = (count / 3) * 100;
  const all = count === 3;
  // The open step: the first still to do, unless another one was clicked. None once everything is done.
  const open = view ?? (all ? -1 : first);

  return (
    <Frame>
      <Header theme={state.settings.theme} />
      <main className={`relative grid w-[1120px] grow grid-cols-[420px_minmax(0,1fr)] items-center gap-20 ${welcome ? 'pb-[72px]' : 'pb-4'}`}>
        <Halo level={welcome ? 0 : level} />

        {/* Left: the battery. It fills as the steps are completed. */}
        <div className="relative flex justify-center">
          {welcome ? (
            <BatteryShape label="A battery that drains while you sit and refills when you move">
              <div className="welcome-drain min-h-6 w-full rounded-[32px]" style={{ height: '62%', backgroundColor: '#FFC56B' }} />
            </BatteryShape>
          ) : (
            <Battery level={level} still={!all} label={`Setup: ${count} of 3 steps done`} />
          )}
        </div>

        {welcome ? (
          <div className="relative flex flex-col gap-9">
            <div className="flex flex-col gap-3.5">
              <h1 className="m-0 text-[72px] leading-[76px] font-bold tracking-[-0.045em] whitespace-nowrap">Stay charged all day.</h1>
              <div className="max-w-[560px] text-[22px] leading-[30px] font-semibold tracking-[-0.01em] text-ink-2">
                We help you build regular, short active breaks into your workday.
              </div>
            </div>
            <ul className="m-0 grid list-none grid-cols-3 gap-4 p-0">
              {BENEFITS.map((b) => (
                <li key={b.title} className="flex flex-col gap-2.5">
                  <span className={`flex size-14 items-center justify-center rounded-2xl ${b.tile}`}>
                    <img src={b.img} alt="" className="size-[38px]" />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[17px] leading-6 font-semibold">{b.title}</span>
                    <span className="text-[15px] leading-5 text-ink-2">{b.text}</span>
                  </span>
                </li>
              ))}
            </ul>
            {/* The Chrome Web Store requires saying what is collected, and getting agreement, before any of it is sent */}
            <form
              className="flex w-fit flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!validEmail) return;
                void browser.storage.local
                  .get('tester')
                  .then(({ tester }) => browser.storage.local.set({ tester: { ...(tester as object), email: email.trim().toLowerCase() } }))
                  .then(() => setProgress({ ...p, started: true }));
              }}
            >
              <label htmlFor="tester-email" className="text-[15px] leading-5 font-semibold">
                Your email
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="tester-email"
                  type="email"
                  value={email}
                  placeholder="you@example.com"
                  autoComplete="email"
                  spellCheck={false}
                  className="h-14 w-[300px] rounded-full border-2 border-line-2 bg-bg px-6 text-[17px] text-ink outline-offset-2"
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!validEmail}
                  className={`inline-flex h-14 items-center rounded-full bg-ink px-9 text-[17px] font-semibold whitespace-nowrap text-on-ink ${validEmail ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
                >
                  Let's start
                </button>
              </div>
              {/* As wide as the field and button above, never wider: w-0 with min-w-full takes the row's width */}
              <p className="m-0 w-0 min-w-full text-[13px] leading-[18px] text-ink-2">
                By starting, you agree to our{' '}
                <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="text-ink-2 underline underline-offset-2">
                  Privacy policy
                </a>
                . We use your email only to recognise your installation and to contact you about your feedback, and product
                usage data only to improve micro.breaks. We never sell either.
              </p>
            </form>
          </div>
        ) : (
          // Right: the three steps on one screen. One is open at a time.
          <div className="relative flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h1 className="m-0 text-[48px] leading-[52px] font-bold tracking-[-0.04em] whitespace-nowrap">
                {all ? 'All set.' : 'Charge your battery.'}
              </h1>
              {all && (
                <div className="text-[22px] leading-[30px] font-semibold tracking-[-0.01em] text-ink-2">
                  {state.settings.calendar
                    ? "It runs on its own whenever you're working. No breaks during your meetings."
                    : "It runs on its own whenever you're working."}
                </div>
              )}
            </div>

            <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
              {steps.map((step, k) => {
                const isOpen = k === open;
                return (
                  <li key={step.head} className={`rounded-card ${isOpen ? 'bg-raised' : ''}`}>
                    <button
                      aria-expanded={isOpen}
                      aria-label={`Step ${k + 1}, ${step.head}${done[k] ? ', done' : ''}`}
                      className="flex w-full cursor-pointer items-center gap-4 rounded-card px-6 py-3 text-left"
                      onClick={() => setView(isOpen ? null : k)}
                    >
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold ${
                          done[k] ? 'bg-pos-bg text-pos' : isOpen ? 'bg-ink text-on-ink' : 'bg-pill text-ink-2'
                        }`}
                      >
                        {done[k] ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        ) : (
                          k + 1
                        )}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-2.5">
                          <span className={`text-[20px] leading-7 font-semibold ${isOpen || done[k] ? 'text-ink' : 'text-ink-2'}`}>{step.head}</span>
                          {step.tag && !done[k] && (
                            <span className="rounded-full bg-pos-bg px-2.5 py-0.5 text-[13px] leading-[18px] font-semibold text-pos">{step.tag}</span>
                          )}
                        </span>
                        {done[k] && !isOpen && <span className="truncate text-[15px] leading-5 text-ink-2">{step.summary}</span>}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="flex flex-col gap-4 px-6 pt-1 pb-4">
                        {k === 0 ? (
                          <TimerSentence settings={state.settings} size="small" meetings={false} />
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            <div className="text-[17px] leading-6 text-ink-2">{step.desc}</div>
                            {step.note && <div className="text-[15px] leading-5 text-ink-3">{step.note}</div>}
                          </div>
                        )}
                        {step.error && (
                          <div role="alert" className="text-[15px] leading-5 text-att">
                            {step.error}
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <Pill primary action={step.main} disabled={k === 1 && connecting} />
                          {step.more.map((a) => (
                            <Pill key={a.label} action={a} />
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>

            {all && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Pill
                    primary
                    large
                    action={state.setupDone ? { label: 'Back to micro.breaks', href: '/newtab.html' } : { label: 'Start moving', run: () => void start() }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      <DevBar {...engine} />
    </Frame>
  );
}

mount(<Setup />);
