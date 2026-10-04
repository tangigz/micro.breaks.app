import { useEffect, useRef } from 'react';
import { send } from '@/data/client';
import { type Break, mission, type MissionView } from '@/engine';
import { clock } from '@/ui/format';
import { missionArt } from '@/ui/missionArt';

const RADIUS = 188;
const LENGTH = 2 * Math.PI * RADIUS;

const skipLink = 'inline-flex min-h-11 shrink-0 cursor-pointer items-center text-[15px] leading-5 text-ink-2 underline underline-offset-[3px]';

function timerLabel(ms: number, paused: boolean): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)} minutes ${s % 60} seconds left${paused ? ', paused' : ''}`;
}

function SkipLink() {
  return (
    <button className={skipLink} onClick={() => void send({ type: 'skip_open' })}>
      Skip (it'll cost you)
    </button>
  );
}

/**
 * The countdown only moves while the user is away. "Paused" means they came back before the end;
 * before any time has run, the screen simply asks them to leave.
 */
export function Running({ b, timer }: { b: Break; timer: MissionView }) {
  const m = mission(b.missionId);
  const paused = !timer.running && timer.remainingMs < timer.durationMs;
  return m.videos && b.videoIndex != null ? (
    <Video b={b} timer={timer} />
  ) : (
    <Ring b={b} timer={timer} paused={paused} />
  );
}

function Ring({ b, timer, paused }: { b: Break; timer: MissionView; paused: boolean }) {
  const m = mission(b.missionId);
  const art = missionArt(m);
  const done = 1 - timer.remainingMs / timer.durationMs;
  const color = paused ? '255,197,107' : '111,207,122';

  return (
    <>
      {/* Halo centred behind the ring: green while charging, amber when paused */}
      <div
        aria-hidden="true"
        className="absolute top-[470px] left-1/2 -mt-[550px] -ml-[550px] size-[1100px] rounded-full"
        style={{ background: `radial-gradient(closest-side, rgba(${color},.20), rgba(${color},0))` }}
      />
      <main className="relative flex w-[1120px] grow flex-col items-center justify-center gap-7 pb-10 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-4">
            <span className={`flex size-16 shrink-0 items-center justify-center rounded-row ${art.tile}`}>
              <img className={`size-11 ${paused ? '' : 'mission-float'}`} src={art.img} alt="" />
            </span>
            <div className="text-[44px] leading-[48px] font-bold tracking-[-0.02em]">{m.name}</div>
          </div>
          <div className="text-[22px] leading-[28px] font-semibold tracking-[-0.01em] text-ink-2">{m.cue}</div>
        </div>

        <div className="relative size-[400px]">
          <svg width="400" height="400" viewBox="0 0 400 400" aria-hidden="true" className="absolute inset-0 -rotate-90">
            <circle cx="200" cy="200" r={RADIUS} fill="none" className="stroke-pill" strokeWidth="12" />
            <circle
              cx="200"
              cy="200"
              r={RADIUS}
              fill="none"
              className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${paused ? 'stroke-att' : 'stroke-pos'}`}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={LENGTH.toFixed(1)}
              strokeDashoffset={(LENGTH * (1 - done)).toFixed(1)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className={`text-[13px] leading-4 font-medium tracking-[0.08em] uppercase ${paused ? 'text-att' : 'text-ink-2'}`}>
              {paused ? 'Paused' : 'Time left'}
            </div>
            <div
              role="timer"
              aria-live="off"
              aria-label={timerLabel(timer.remainingMs, paused)}
              className={`text-[120px] leading-[112px] font-bold tracking-[-0.045em] ${paused ? 'text-ink-2' : ''}`}
            >
              {clock(timer.remainingMs)}
            </div>
            <div className="text-[15px] leading-5 text-ink-2">of {Math.round(timer.durationMs / 60_000)} min</div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          {paused ? (
            <div role="status" className="flex min-h-12 items-center gap-3 rounded-full bg-att-bg px-5 py-3 text-[17px] leading-6">
              <svg width="20" height="20" viewBox="0 0 24 24" className="fill-att">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
              <span>
                <b className="font-semibold">Step away to continue.</b> You touched the keyboard or mouse.
              </span>
            </div>
          ) : (
            <div className="flex min-h-12 items-center gap-3 text-[17px] leading-6 text-ink-2">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className="stroke-pos"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="4" width="20" height="13" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              <span>
                <b className="font-semibold text-ink">Leave the computer.</b> The timer only runs while you're away.
              </span>
            </div>
          )}
          <SkipLink />
        </div>
      </main>
    </>
  );
}

/** Reports the length of the YouTube video once its player has loaded, without loading YouTube's script. */
function useVideoDuration(frame: React.RefObject<HTMLIFrameElement | null>, wanted: boolean) {
  useEffect(() => {
    if (!wanted) return;
    let sent = false;
    const listen = () =>
      frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'mb', channel: 'widget' }), '*');
    const onMessage = (e: MessageEvent) => {
      if (sent || e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return;
      try {
        const seconds = JSON.parse(e.data)?.info?.duration;
        if (typeof seconds === 'number' && seconds > 0) {
          sent = true;
          void send({ type: 'video_duration', ms: Math.round(seconds * 1000) });
        }
      } catch {
        // Not a player message
      }
    };
    window.addEventListener('message', onMessage);
    const poll = setInterval(listen, 1000);
    return () => {
      window.removeEventListener('message', onMessage);
      clearInterval(poll);
    };
  }, [frame, wanted]);
}

/** Video mission: a 16:9 YouTube player, the countdown below. It runs on the clock and ends with a button. */
function Video({ b, timer }: { b: Break; timer: MissionView }) {
  const m = mission(b.missionId);
  const videos = m.videos!;
  const video = videos[b.videoIndex!]!;
  const frame = useRef<HTMLIFrameElement>(null);
  useVideoDuration(frame, !!b.awaitingVideoDuration);

  const over = !b.awaitingVideoDuration && timer.remainingMs <= 0;

  const params = new URLSearchParams({ autoplay: '1', rel: '0', playsinline: '1', enablejsapi: '1' });
  if (video.start != null) params.set('start', String(video.start));
  if (video.end != null) params.set('end', String(video.end));

  return (
    <main className="relative flex w-[1040px] grow flex-col justify-center gap-6 pb-8">
      <iframe
        ref={frame}
        title={`${m.name}, video ${b.videoIndex! + 1} of ${videos.length}`}
        src={`https://www.youtube-nocookie.com/embed/${video.id}?${params}`}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="h-[585px] w-[1040px] rounded-panel border border-line bg-[#141416]"
      />
      <div className="flex items-center gap-8">
        {over ? (
          <button
            autoFocus
            className="inline-flex h-[72px] shrink-0 cursor-pointer items-center gap-3 rounded-full bg-ink px-10 text-[20px] font-semibold text-on-ink"
            onClick={() => void send({ type: 'video_done' })}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            I've done the routine
          </button>
        ) : (
          <div
            role="timer"
            aria-live="off"
            aria-label={timerLabel(timer.remainingMs, false)}
            className="text-[88px] leading-[88px] font-bold tracking-[-0.045em]"
          >
            {clock(timer.remainingMs)}
          </div>
        )}
        <div className="flex grow flex-col gap-1">
          <div className="text-[28px] leading-[34px] font-bold tracking-[-0.015em]">
            {m.name} <span className="text-ink-2">· video {b.videoIndex! + 1} of {videos.length}</span>
          </div>
          <div className="text-[17px] leading-6 text-ink-2">
            {over ? (
              <>
                <b className="font-semibold text-ink">The video is over.</b> Confirm to recharge your battery.
              </>
            ) : (
              <>
                <b className="font-semibold text-ink">Follow along.</b> Hands off the keyboard.
              </>
            )}
          </div>
        </div>
        <SkipLink />
      </div>
    </main>
  );
}
