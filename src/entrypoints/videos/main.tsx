import { useEffect, useRef, useState } from 'react';
import { MISSIONS } from '@/engine';
import { useStored } from '@/data/stored';
import { Wordmark } from '@/ui/Header';
import { mount } from '@/ui/mount';
import { applySavedTheme } from '@/ui/theme';
import '@/ui/tokens.css';

applySavedTheme();

/**
 * Test mode only: play each mission video as the extension embeds it, check the sound,
 * and set where the routine starts and ends. The trims are kept in storage under "videoTrims";
 * they go into content/missions.json once they are right.
 */

interface Trim {
  start: number | null;
  end: number | null;
}

const VIDEOS = MISSIONS.flatMap((m) => (m.videos ?? []).map((v, i) => ({ mission: m.name, n: i + 1, ...v })));
const SAVED: Record<string, Trim> = Object.fromEntries(VIDEOS.map((v) => [v.id, { start: v.start, end: v.end }]));

const mmss = (s: number | null) => (s == null ? '–' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);

const pill = 'h-10 cursor-pointer rounded-full bg-pill px-4 text-[15px] font-medium text-ink';
const primary = 'h-10 cursor-pointer rounded-full bg-ink px-4 text-[15px] font-semibold text-on-ink';

/** Talks to the YouTube player through postMessage, without loading YouTube's script. */
function usePlayer(frame: React.RefObject<HTMLIFrameElement | null>, key: string) {
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setTime(0);
    setDuration(0);
    const post = (message: object) => frame.current?.contentWindow?.postMessage(JSON.stringify(message), '*');
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return;
      try {
        const info = JSON.parse(e.data)?.info;
        if (typeof info?.currentTime === 'number') setTime(info.currentTime);
        if (typeof info?.duration === 'number' && info.duration > 0) setDuration(info.duration);
      } catch {
        // Not a player message
      }
    };
    window.addEventListener('message', onMessage);
    const poll = setInterval(() => post({ event: 'listening', id: 'mb', channel: 'widget' }), 1000);
    return () => {
      window.removeEventListener('message', onMessage);
      clearInterval(poll);
    };
  }, [frame, key]);

  const command = (func: string, args: unknown[] = []) =>
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
  return {
    time,
    duration,
    seek: (s: number) => {
      command('seekTo', [Math.max(0, s), true]);
      command('playVideo');
    },
  };
}

function Review() {
  const [trims, setTrims] = useStored<Record<string, Trim>>('videoTrims', SAVED);
  const [selected, setSelected] = useState(VIDEOS[0]!.id);
  /** Preview: the player exactly as a mission shows it, trimmed and without controls. */
  const [preview, setPreview] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const player = usePlayer(frame, `${selected}-${preview}`);

  if (!import.meta.env.DEV) return <p className="p-10 text-ink-2">This page only exists in test mode.</p>;
  if (!trims) return null;

  const video = VIDEOS.find((v) => v.id === selected)!;
  const trim = trims[selected] ?? { start: null, end: null };
  const set = (patch: Partial<Trim>) => setTrims({ ...trims, [selected]: { ...trim, ...patch } });
  const nudge = (field: keyof Trim, by: number) => set({ [field]: Math.max(0, (trim[field] ?? 0) + by) });

  const params = new URLSearchParams({ autoplay: '1', rel: '0', playsinline: '1', enablejsapi: '1' });
  if (preview) {
    Object.entries({ controls: '0', disablekb: '1', fs: '0', iv_load_policy: '3' }).forEach(([k, v]) => params.set(k, v));
    if (trim.start != null) params.set('start', String(trim.start));
    if (trim.end != null) params.set('end', String(trim.end));
  }
  const length = trim.end != null ? trim.end - (trim.start ?? 0) : player.duration ? player.duration - (trim.start ?? 0) : null;

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-10 py-6">
      <header className="flex items-center justify-between">
        <Wordmark />
        <a href="/newtab.html" className="text-[15px] text-ink-2 underline underline-offset-[3px]">
          Back to the new tab
        </a>
      </header>
      <div>
        <h1 className="m-0 text-[44px] leading-[48px] font-bold tracking-[-0.02em]">Mission videos</h1>
        <p className="m-0 mt-2 text-[17px] leading-6 text-ink-2">
          Test mode. Play each video as the extension embeds it, check the sound, and mark where the routine starts and ends.
        </p>
      </div>

      <div className="grid grid-cols-[300px_minmax(0,1fr)] gap-8">
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {VIDEOS.map((v) => {
            const t = trims[v.id] ?? { start: null, end: null };
            const on = v.id === selected;
            return (
              <li key={v.id}>
                <button
                  aria-pressed={on}
                  className={`flex w-full cursor-pointer flex-col gap-0.5 rounded-row px-4 py-3 text-left ${on ? 'bg-raised' : ''}`}
                  onClick={() => {
                    setSelected(v.id);
                    setPreview(false);
                  }}
                >
                  <span className={`text-[17px] leading-6 font-semibold ${on ? 'text-ink' : 'text-ink-2'}`}>
                    {v.mission} · {v.n}
                  </span>
                  <span className="text-[13px] leading-4 text-ink-2">
                    {t.start == null && t.end == null ? 'Not trimmed' : `${mmss(t.start ?? 0)} → ${mmss(t.end)}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col gap-5">
          <iframe
            key={`${selected}-${preview}`}
            ref={frame}
            title={`${video.mission}, video ${video.n}`}
            src={`https://www.youtube-nocookie.com/embed/${video.id}?${params}`}
            allow="autoplay; encrypted-media"
            className="aspect-video w-full rounded-panel border border-line bg-[#141416]"
          />

          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-[17px] leading-6">
            <span>
              <span className="text-ink-2">Now </span>
              <b data-testid="now" className="font-semibold">{mmss(player.time)}</b>
              <span className="text-ink-2"> of {mmss(player.duration || null)}</span>
            </span>
            <span>
              <span className="text-ink-2">Mission length </span>
              <b className="font-semibold">{mmss(length)}</b>
            </span>
            <span className="text-[15px] text-ink-2">{preview ? 'Preview: as the mission shows it.' : 'Editing: full video, with YouTube’s controls.'}</span>
          </div>

          {(['start', 'end'] as const).map((field) => (
            <div key={field} className="flex flex-wrap items-center gap-2">
              <span className="w-28 text-[17px] leading-6">
                <span className="text-ink-2">{field === 'start' ? 'Start ' : 'End '}</span>
                <b data-testid={field} className="font-semibold">{mmss(trim[field])}</b>
              </span>
              <button className={primary} onClick={() => set({ [field]: Math.floor(player.time) })}>
                Set to now ({mmss(player.time)})
              </button>
              <button className={pill} aria-label={`${field} one second earlier`} onClick={() => nudge(field, -1)}>
                −1 s
              </button>
              <button className={pill} aria-label={`${field} one second later`} onClick={() => nudge(field, 1)}>
                +1 s
              </button>
              <button
                className={pill}
                disabled={trim[field] == null}
                onClick={() => player.seek(field === 'start' ? trim.start! : trim.end! - 5)}
              >
                {field === 'start' ? 'Play from the start' : 'Play the last 5 s'}
              </button>
              <button className={pill} onClick={() => set({ [field]: null })}>
                Clear
              </button>
            </div>
          ))}

          <div className="flex items-center gap-3">
            <button className={preview ? pill : primary} onClick={() => setPreview(!preview)}>
              {preview ? 'Back to editing' : 'Preview as a mission'}
            </button>
            <span className="text-[15px] leading-5 text-ink-2">Trims are saved as you go. Tell Claude when they are right.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

mount(<Review />);
