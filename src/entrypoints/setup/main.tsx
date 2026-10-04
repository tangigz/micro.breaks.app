import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import bell from '@/assets/emoji/bell.png';
import brain from '@/assets/emoji/brain.png';
import biceps from '@/assets/emoji/flexed-biceps.png';
import voltage from '@/assets/emoji/high-voltage.png';
import laptop from '@/assets/emoji/laptop.png';
import stopwatch from '@/assets/emoji/stopwatch.png';
import { send, useEngine } from '@/data/client';
import { useStored } from '@/data/stored';
import type { Settings } from '@/engine';
import { Halo, rgb } from '@/ui/Battery';
import { DevBar } from '@/ui/DevBar';
import { Frame } from '@/ui/Frame';
import { timeOfDay } from '@/ui/format';
import { Header } from '@/ui/Header';
import { applySavedTheme, applyTheme } from '@/ui/theme';
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
  img: string;
  tile: string;
  head: string;
  desc: string;
  main: Action;
  more: Action[];
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

function timerLine(s: Settings): string {
  const days = s.days === 'every' ? 'every day' : 'on weekdays';
  return `Every ${s.intervalMin} min, ${timeOfDay(s.dayStart)}–${timeOfDay(s.dayEnd)}, ${days}. Not during lunch, ${timeOfDay(s.lunchStart)}⁠–⁠${timeOfDay(s.lunchEnd)}.`;
}

function Pill({ action, primary }: { action: Action; primary?: boolean }) {
  const look = primary
    ? 'bg-ink px-9 text-[17px] text-on-ink'
    : 'bg-pill px-6 text-[15px] text-ink';
  const className = `inline-flex h-14 cursor-pointer items-center rounded-full font-semibold whitespace-nowrap no-underline ${look}`;
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
  { img: brain, tile: 'bg-tile-lilac', title: 'Sharper focus', text: 'It lasts until the work is done.' },
  { img: biceps, tile: 'bg-tile-green', title: 'A looser body', text: 'No stiff neck or lower back.' },
];

function Setup() {
  const engine = useEngine();
  const [progress, setProgress] = useStored<Progress>('setup', START);
  const [view, setView] = useStored<number | null>('setupView', null);
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
  /** Records progress without leaving the step. */
  const stay = (patch: Partial<Progress>) => setProgress({ ...p, ...patch });

  const done = [p.timer, p.notifications >= 3, p.login >= 2];
  const count = done.filter(Boolean).length;
  const first = done.indexOf(false);
  const welcome = !p.started && !state.setupDone;
  // The screen shows the first step still to do, unless a cell was clicked. 3 is "All set."
  const shown = view ?? (first < 0 ? 3 : first);
  const ready = !welcome && shown >= 3;
  const next = (k: number): Action => ({ label: 'Next', run: () => setView(k + 1 > 2 && count < 3 ? first : k + 1) });

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
      img: stopwatch,
      tile: 'bg-tile-lilac',
      head: 'Set your movement timer.',
      desc: timerLine(state.settings),
      main: p.timer ? next(0) : { label: 'Keep these', run: () => advance({ timer: true }) },
      more: [{ label: 'Edit', href: '/settings.html?from=setup' }],
    },
    {
      img: bell,
      tile: 'bg-tile-peach',
      head: 'Make notifications stay.',
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
              ? { label: 'Yes, it stayed', run: () => advance({ notifications: 3 }) }
              : next(1),
      more: n === 2 ? [{ label: 'Send again', run: test }] : n >= 3 ? [{ label: 'Send a test', run: test }] : [],
    },
    {
      img: laptop,
      tile: 'bg-tile-blue',
      head: 'Open Chrome at login.',
      desc:
        p.login === 0
          ? 'micro.breaks only runs when Chrome is open. Add it to login items to suggest when to move more precisely.'
          : p.login === 1
            ? 'System Settings › General › Login Items › “+” › Google Chrome.'
            : 'Chrome opens when you log in. micro.breaks starts with it.',
      main: p.login >= 2 ? next(2) : { label: 'Done', run: () => advance({ login: 2 }) },
      more: [{ label: 'Show me how', run: () => stay({ login: 1 }) }],
    },
  ];
  const step = steps[Math.min(shown, 2)]!;
  const stepDone = !welcome && !ready && done[shown];

  const start = async () => {
    await send({ type: 'setup_done' });
    location.href = '/newtab.html';
  };

  // Charge colour: coral at 0 of 3, amber, green at 3 of 3: the battery's own scale
  const level = (count / 3) * 100;

  return (
    <Frame>
      <Header theme={state.settings.theme} />
      <main className="relative grid w-[1120px] grow grid-cols-[420px_minmax(0,1fr)] items-center gap-20 pb-[72px]">
        <Halo level={level} />

        {/* Left: the step's illustration, or the battery */}
        <div className="relative flex justify-center">
          {welcome ? (
            <BatteryShape label="A battery that drains while you sit and refills when you move">
              <div className="welcome-drain min-h-6 w-full rounded-[32px]" style={{ height: '62%', backgroundColor: '#FFC56B' }} />
            </BatteryShape>
          ) : ready ? (
            <BatteryShape label="Battery full, setup is complete" glow>
              <div className="w-full grow rounded-[32px] bg-[#6FCF7A]" />
            </BatteryShape>
          ) : (
            <div className={`flex size-[380px] items-center justify-center rounded-[56px] ${step.tile}`}>
              <img className="tile-float size-[232px]" src={step.img} alt="" />
            </div>
          )}
        </div>

        {/* Right: one step is the whole screen */}
        <div className="relative flex flex-col gap-9">
          <div className="flex flex-col gap-3.5">
            <div
              className={`text-[13px] leading-4 font-medium tracking-[0.08em] uppercase ${ready || stepDone ? 'text-pos' : 'text-ink-2'}`}
            >
              {welcome ? 'Welcome' : ready ? 'Setup complete' : `Step ${shown + 1} of 3${stepDone ? ' · Done' : ''}`}
            </div>
            <h1 className="m-0 w-[551px] text-[88px] leading-[88px] font-bold tracking-[-0.045em]">
              {welcome ? 'Stay charged all day.' : ready ? 'All set.' : step.head}
            </h1>
            <div className="max-w-[560px] text-[22px] leading-[30px] font-semibold tracking-[-0.01em] text-ink-2">
              {welcome
                ? 'We help you build regular, short active breaks into your workday.'
                : ready
                  ? "It runs on its own whenever you're working."
                  : step.desc}
            </div>
          </div>

          {welcome && (
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
          )}

          <div className="flex items-center gap-3">
            {welcome ? (
              <>
                <Pill primary action={{ label: 'Set it up', run: () => setProgress({ ...p, started: true }) }} />
                <span className="ml-2 text-[15px] leading-5 text-ink-2">Three steps, about a minute.</span>
              </>
            ) : ready ? (
              <Pill
                primary
                action={state.setupDone ? { label: 'Back to micro.breaks', href: '/newtab.html' } : { label: 'Start moving', run: () => void start() }}
              />
            ) : (
              <>
                <Pill primary action={step.main} />
                {step.more.map((a) => (
                  <Pill key={a.label} action={a} />
                ))}
              </>
            )}
          </div>

          {/* Progress: three cells, each one opens its step */}
          {!welcome && (
            <div className="flex items-center gap-3.5">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((k) => (
                  <button
                    key={k}
                    aria-label={`Step ${k + 1}${done[k] ? ', done' : ''}`}
                    aria-current={k === shown ? 'step' : undefined}
                    className="flex h-11 w-14 cursor-pointer items-center"
                    onClick={() => setView(k)}
                  >
                    <span
                      className={`w-full rounded-full ${k === shown ? 'h-3.5' : 'h-2.5'} ${done[k] ? '' : 'bg-pill'}`}
                      style={done[k] ? { backgroundColor: `rgb(${rgb({ level })})` } : undefined}
                    />
                  </button>
                ))}
              </div>
              <span className="text-[15px] leading-5 font-semibold text-ink-2">{count} of 3 done</span>
            </div>
          )}
        </div>
      </main>
      <DevBar {...engine} />
    </Frame>
  );
}

createRoot(document.getElementById('root')!).render(<Setup />);
