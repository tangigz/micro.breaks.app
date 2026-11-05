import type { ReactNode } from 'react';
import type { Settings, ToolbarView } from '@/engine';
import { batteryRgb } from './battery-color';
import { type PopupAction, popupCopy, type Tone } from './toolbar-copy';
import { timeOfDay } from './format';

export type PopupTarget = 'start' | 'mission' | 'settings' | 'how' | 'moved' | 'kept_working';

/** The battery colour as "r g b", or the grey token when not tracking. */
function color(view: ToolbarView): string {
  if (view.tone === 'grey') return 'var(--grey)';
  return batteryRgb(view.tone === 'green' ? 100 : view.level).join(' ');
}

/** 48 × 88, the new tab's battery in small. An empty battery keeps a sliver. */
function MiniBattery({ view, label }: { view: ToolbarView; label: string }) {
  const c = color(view);
  const glow = view.tone === 'grey' ? 'var(--grey-glow)' : 'var(--glow-max)';
  return (
    <div className="relative flex shrink-0 flex-col items-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 size-[180px] -translate-1/2 rounded-full"
        style={{ background: `radial-gradient(closest-side, rgb(${c} / ${glow}), rgb(${c} / 0))` }}
      />
      <div className="relative h-1.5 w-[22px] rounded-t-[3px] bg-ink" />
      <div
        role="img"
        aria-label={label}
        className="relative flex h-[88px] w-12 flex-col justify-end rounded-[14px] border-[3px] border-ink p-[4px]"
      >
        <div
          className="w-full rounded-[8px] transition-[height,background-color] duration-1000 ease-linear"
          style={{
            height: `${view.level}%`,
            minHeight: 5,
            backgroundColor: `rgb(${c})`,
            boxShadow: view.tone === 'grey' ? undefined : `0 0 14px rgb(${c} / 0.45)`,
          }}
        />
      </div>
    </div>
  );
}

const TONES: Record<Tone, string> = { ink: 'text-ink-2', neg: 'text-neg', att: 'text-att' };

function batteryLabel(view: ToolbarView): string {
  if (view.tone === 'grey') return 'Battery idle, not tracking right now';
  if (view.state === 'lunch') return 'Battery full, recharging during lunch';
  if (view.state === 'mission') return 'Battery recharging during your mission';
  if (view.level <= 0) return 'Battery empty';
  return `Battery at ${Math.round(view.level)} percent`;
}

function Primary({ children, onClick, quiet }: { children: ReactNode; onClick: () => void; quiet?: boolean }) {
  return (
    <button
      className={`inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full text-[15px] font-semibold ${quiet ? 'bg-pill text-ink' : 'bg-ink text-on-ink'}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Actions({ action, act }: { action: PopupAction | null; act: (t: PopupTarget) => void }) {
  switch (action) {
    case 'start':
      return (
        <Primary onClick={() => act('start')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="6 3 20 12 6 21 6 3" />
          </svg>
          Start a break now
        </Primary>
      );
    case 'mission':
      return <Primary onClick={() => act('mission')}>Go to your mission</Primary>;
    case 'how':
      return <Primary onClick={() => act('how')}>How it works</Primary>;
    case 'gap':
      return (
        <div className="flex flex-col gap-2.5">
          <Primary onClick={() => act('moved')}>Yes, I moved</Primary>
          <Primary quiet onClick={() => act('kept_working')}>
            No, I kept working
          </Primary>
        </div>
      );
    default:
      return null;
  }
}

/** The toolbar popup: a mini new tab, 320 px wide. */
export function Popup({
  view,
  settings,
  now,
  act,
}: {
  view: ToolbarView;
  settings: Settings;
  now: number;
  act: (target: PopupTarget) => void;
}) {
  const copy = popupCopy(view, settings, now);
  const hours = `${timeOfDay(settings.dayStart)}–${timeOfDay(settings.dayEnd)}`;
  const { line } = copy;

  return (
    <div className="flex w-[320px] flex-col overflow-hidden bg-bg text-ink">
      <div className="flex flex-col gap-[18px] px-5 pt-[18px] pb-5">
        <div className="text-[15px] leading-5 font-bold tracking-[-0.01em]">
          micro<span className="text-pos">.</span>breaks
        </div>

        <div className="flex items-center gap-[18px]">
          <MiniBattery view={view} label={batteryLabel(view)} />
          <div className="relative flex min-w-0 flex-col gap-1">
            <div className={`text-[12px] leading-4 font-medium tracking-[0.08em] uppercase ${TONES[copy.eyebrowTone]}`}>
              {copy.eyebrow}
            </div>
            <div
              role={copy.big ? 'timer' : undefined}
              className={`font-bold tracking-[-0.035em] ${copy.big ? 'text-[44px] leading-[48px]' : 'text-[32px] leading-[34px]'}`}
            >
              {copy.headline}
            </div>
          </div>
        </div>

        <p className="relative m-0 text-[15px] leading-5 text-ink-2">
          {line.before}
          {line.strong && <b className="font-semibold text-ink">{line.strong}</b>}
          {line.after}
        </p>

        <div className="relative flex flex-col gap-[18px]">
          <Actions action={copy.action} act={act} />
          <button
            aria-label={`Edit your movement timer: every ${settings.intervalMin} minutes, ${hours}`}
            className="inline-flex h-9 cursor-pointer items-center gap-2 self-start rounded-full border border-line px-3.5 text-[13px] font-medium text-ink-2"
            onClick={() => act('settings')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2 2M10 2h4" />
            </svg>
            Every {settings.intervalMin} min · {hours}
          </button>
        </div>
      </div>

    </div>
  );
}
