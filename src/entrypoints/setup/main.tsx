import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import brain from '@/assets/emoji/brain.png';
import biceps from '@/assets/emoji/flexed-biceps.png';
import voltage from '@/assets/emoji/high-voltage.png';
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

applySavedTheme();

/** Where the welcome flow stands. Kept in storage so a closed tab resumes where it left off. */
interface Progress {
  started: boolean;
  timer: boolean;
  /** 0 not allowed yet · 1 allowed · 2 test sent · 3 the test stayed */
  notifications: 0 | 1 | 2 | 3;
  /** 0 to do · 1 "Show me how" open · 2 done */
  login: 0 | 1 | 2;
}

const START: Progress = { started: false, timer: false, notifications: 0, login: 0 };

type Action = { label: string; run: () => void } | { label: string; href: string };

interface Step {
  head: string;
  /** One line once the step is done. */
  summary: string;
  /** Step 1 shows the editable sentence instead. */
  desc?: string;
  main: Action;
  more: Action[];
}

function timerLine(s: Settings): string {
  const days = s.days === 'every' ? 'every day' : 'on weekdays';
  return `Every ${s.intervalMin} min, ${timeOfDay(s.dayStart)}–${timeOfDay(s.dayEnd)}, ${days}.`;
}

async function sendTest(): Promise<void> {
  await browser.notifications.clear('test');
  await browser.notifications.create('test', {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title: 'Notifications work.',
    message: "This one stays until you close it. That's how your breaks will reach you.",
    requireInteraction: true,
  });
}

function Pill({ action, primary, large }: { action: Action; primary?: boolean; large?: boolean }) {
  const look = primary ? 'bg-ink text-on-ink' : 'bg-pill text-ink';
  const size = large ? (primary ? 'h-14 px-9 text-[17px]' : 'h-14 px-6 text-[15px]') : 'h-12 px-6 text-[15px]';
  const className = `inline-flex cursor-pointer items-center rounded-full font-semibold whitespace-nowrap no-underline ${look} ${size}`;
  return 'href' in action ? (
    <a href={action.href} className={className}>
      {action.label}
    </a>
  ) : (
    <button className={className} onClick={action.run}>
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
  const [progress, setProgress] = useStored<Progress>('setup', START);
  const [view, setView] = useStored<number | null>('setupView', null);
  const [calendarError, setCalendarError] = useState<string>();
  const [email, setEmail] = useState('');
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const theme = engine?.state.settings.theme;

  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);

  // "Turn on" from the new tab's health line lands on the notifications step
  useEffect(() => {
    const step = Number(new URLSearchParams(location.search).get('step'));
    if (progress && step >= 1 && step <= 3) {
      setProgress({ ...progress, started: true, notifications: 0 });
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
  const completeStep = (step: number, patch: Partial<Progress>) => {
    if (!done[step - 1]) track('setup_step_done', { step });
    advance(patch);
  };
  /** Records progress without leaving the step. */
  const stay = (patch: Partial<Progress>) => setProgress({ ...p, ...patch });

  const done = [p.timer, p.notifications >= 3, p.login >= 2];
  const count = done.filter(Boolean).length;
  const first = done.indexOf(false);
  const welcome = !p.started && !state.setupDone;
  /** Closes a finished step and moves to the first one still to do. */
  const next: Action = { label: 'Continue', run: () => setView(null) };

  const allow = async () => {
    if ((await browser.notifications.getPermissionLevel()) === 'granted') stay({ notifications: 1 });
    else await browser.tabs.create({ url: 'chrome://settings/content/notifications' });
  };
  const test = () => {
    void sendTest();
    stay({ notifications: p.notifications >= 3 ? 3 : 2 });
  };

  const n = p.notifications;
  const steps: Step[] = [
    {
      head: 'Set your movement timer',
      summary: timerLine(state.settings),
      main: { label: 'Continue', run: () => completeStep(1, { timer: true }) },
      more: [],
    },
    {
      head: 'Make notifications stay',
      summary: 'Alerts are on. Notifications wait for you.',
      desc:
        n === 0
          ? 'Allow notifications, then set Chrome to Alerts, not Banners, in System Settings › Notifications.'
          : n === 1
            ? 'Allowed. Now set Chrome to Alerts in System Settings › Notifications, then test.'
            : n === 2
              ? 'Did the test stay on screen until you closed it?'
              : 'Alerts are on. Notifications wait for you.',
      main:
        n === 0
          ? { label: 'Allow', run: () => void allow() }
          : n === 1
            ? { label: 'Send a test', run: test }
            : n === 2
              ? { label: 'Yes, it stayed', run: () => completeStep(2, { notifications: 3 }) }
              : next,
      more: n === 2 ? [{ label: 'Send again', run: test }] : n >= 3 ? [{ label: 'Send a test', run: test }] : [],
    },
    {
      head: 'Open Chrome at login',
      summary: 'Chrome opens when you log in. micro.breaks starts with it.',
      desc:
        p.login === 0
          ? 'micro.breaks only runs when Chrome is open. Add it to login items to suggest when to move more precisely.'
          : p.login === 1
            ? 'System Settings › General › Login Items › “+” › Google Chrome.'
            : 'Chrome opens when you log in. micro.breaks starts with it.',
      main: p.login >= 2 ? next : { label: 'Done', run: () => completeStep(3, { login: 2 }) },
      more: [{ label: 'Show me how', run: () => stay({ login: 1 }) }],
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

  // The steps list is taller than the other screens: it needs nearly the full frame height
  return (
    <Frame tall={!welcome}>
      <Header theme={state.settings.theme} />
      <main className="relative grid w-[1120px] grow grid-cols-[420px_minmax(0,1fr)] items-center gap-20 pb-[72px]">
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
            {/* Test phase: an email tells testers apart in the usage data. What is shared is explained in the README. */}
            <form
              className="flex flex-col gap-3"
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
            </form>
          </div>
        ) : (
          // Right: the three steps on one screen. One is open at a time.
          <div className="relative flex flex-col gap-7">
            <div className="flex flex-col gap-2">
              <h1 className="m-0 text-[56px] leading-[60px] font-bold tracking-[-0.04em] whitespace-nowrap">
                {all ? 'All set.' : 'Charge your battery.'}
              </h1>
              <div className="text-[22px] leading-[30px] font-semibold tracking-[-0.01em] text-ink-2">
                {!all
                  ? 'Three steps and micro.breaks is ready.'
                  : state.settings.calendar
                    ? "It runs on its own whenever you're working. No prompts during your meetings."
                    : "It runs on its own whenever you're working. Optional: connect Google Calendar so prompts wait for your meetings to end."}
              </div>
            </div>

            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {steps.map((step, k) => {
                const isOpen = k === open;
                return (
                  <li key={step.head} className={`rounded-card ${isOpen ? 'bg-raised' : ''}`}>
                    <button
                      aria-expanded={isOpen}
                      aria-label={`Step ${k + 1}, ${step.head}${done[k] ? ', done' : ''}`}
                      className="flex w-full cursor-pointer items-center gap-4 rounded-card px-6 py-4 text-left"
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
                        <span className={`text-[20px] leading-7 font-semibold ${isOpen || done[k] ? 'text-ink' : 'text-ink-2'}`}>{step.head}</span>
                        {done[k] && !isOpen && <span className="truncate text-[15px] leading-5 text-ink-2">{step.summary}</span>}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="flex flex-col gap-5 px-6 pt-1 pb-6">
                        {k === 0 ? (
                          <TimerSentence settings={state.settings} size="small" />
                        ) : (
                          <div className="text-[17px] leading-6 text-ink-2">{step.desc}</div>
                        )}
                        <div className="flex items-center gap-3">
                          <Pill primary action={step.main} />
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
                  {state.settings.calendar ? (
                    <span className="inline-flex h-14 items-center gap-2 rounded-full bg-pos-bg px-[22px] text-[15px] font-semibold whitespace-nowrap text-pos">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      Google Calendar connected
                    </span>
                  ) : (
                    <Pill large action={{ label: 'Connect Google Calendar', run: () => void setCalendar(true).then(setCalendarError) }} />
                  )}
                </div>
                {calendarError && (
                  <div role="alert" className="text-[15px] leading-5 text-att">
                    {calendarError}
                  </div>
                )}
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
