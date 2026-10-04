import { type CSSProperties, useEffect, useState } from 'react';
import bolt from '@/assets/emoji/high-voltage.png';

const PARTICLES: { dx: number; dy: number; size: number; color: string; square?: boolean; delay: number }[] = [
  { dx: -150, dy: -110, size: 14, color: '#6FCF7A', delay: 2.45 },
  { dx: 150, dy: -120, size: 10, color: '#FFC56B', delay: 2.5 },
  { dx: -90, dy: -190, size: 12, color: '#8EC5FF', square: true, delay: 2.45 },
  { dx: 100, dy: -200, size: 14, color: '#6FCF7A', delay: 2.55 },
  { dx: -190, dy: -20, size: 10, color: '#C9B6FF', delay: 2.5 },
  { dx: 190, dy: -30, size: 12, color: '#FFC56B', square: true, delay: 2.45 },
  { dx: -20, dy: -230, size: 10, color: '#8EC5FF', delay: 2.5 },
  { dx: 40, dy: -150, size: 12, color: '#6FCF7A', delay: 2.6 },
];

const BUBBLES = [
  { left: 30, size: 10, delay: 0.4 },
  { left: 90, size: 7, delay: 1 },
  { left: 130, size: 12, delay: 1.6 },
  { left: 60, size: 6, delay: 0.8 },
];

/** True once the tab is in front: the celebration waits for someone to see it. */
function useSeen(): boolean {
  const [seen, setSeen] = useState(document.visibilityState === 'visible');
  useEffect(() => {
    if (seen) return;
    const onChange = () => document.visibilityState === 'visible' && setSeen(true);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [seen]);
  return seen;
}

/** Breaks end with a short refill animation, then straight back to work. No minutes, no count. */
export function Recharged({ eyebrow, onDone }: { eyebrow?: string; onDone: () => void }) {
  const seen = useSeen();

  useEffect(() => {
    if (!seen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Enter' && onDone();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [seen, onDone]);

  if (!seen) return null;
  return (
    <main className="relative grid w-[1120px] grow grid-cols-[420px_minmax(0,1fr)] items-center gap-20 pb-[72px]">
      <div
        aria-hidden="true"
        className="rc-halo absolute top-[378px] left-[270px] -mt-[550px] -ml-[550px] size-[1100px] rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(111,207,122,.30), rgba(111,207,122,0))' }}
      />

      {/* Battery that refills */}
      <div className="relative flex flex-col items-center gap-1.5">
        <div aria-hidden="true" className="absolute top-10 left-1/2 size-0">
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className={`rc-particle absolute ${p.square ? 'rounded-[3px]' : 'rounded-full'}`}
              style={
                {
                  width: p.size,
                  height: p.size,
                  margin: -p.size / 2,
                  background: p.color,
                  animationDelay: `${p.delay}s`,
                  '--dx': `${p.dx}px`,
                  '--dy': `${p.dy}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <div aria-hidden="true" className="absolute -top-24 left-1/2 -ml-12 size-24">
          <div className="rc-pop">
            <img className="rc-float block size-24" src={bolt} alt="" />
          </div>
        </div>

        <div className="h-4 w-[72px] rounded-t-[10px] bg-ink" />
        <div
          role="img"
          aria-label="Battery recharged to 100 percent"
          className="rc-glow relative flex h-[440px] w-[220px] flex-col justify-end rounded-[48px] border-[6px] border-ink p-3"
        >
          <span aria-hidden="true" className="rc-ripple absolute -inset-1.5 rounded-[48px] border-[3px] border-[#6FCF7A]" />
          <span
            aria-hidden="true"
            className="rc-ripple absolute -inset-1.5 rounded-[48px] border-2 border-[#6FCF7A]"
            style={{ animationDelay: '2.75s' }}
          />
          <div className="rc-fill relative h-full w-full overflow-hidden rounded-[32px] bg-[#6FCF7A]">
            <svg
              className="rc-wave absolute -top-0.5 left-0 block"
              aria-hidden="true"
              width="392"
              height="24"
              viewBox="0 0 392 24"
              preserveAspectRatio="none"
            >
              <path d="M0 12 Q24.5 0 49 12 T98 12 T147 12 T196 12 T245 12 T294 12 T343 12 T392 12 V0 H0 Z" fill="rgba(255,255,255,.35)" />
            </svg>
            {BUBBLES.map((b, i) => (
              <span
                key={i}
                className="rc-bubble absolute bottom-2.5 rounded-full bg-white/55"
                style={{ left: b.left, width: b.size, height: b.size, animationDelay: `${b.delay}s` }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="relative flex flex-col gap-10">
        <div className="flex flex-col gap-3.5">
          {eyebrow && <div className="rc-rise text-[13px] leading-4 font-medium tracking-[0.08em] text-ink-2 uppercase">{eyebrow}</div>}
          <h1 className="rc-rise m-0 text-[104px] leading-[100px] font-bold tracking-[-0.045em]" style={{ animationDelay: '2.65s' }}>
            Recharged.
          </h1>
        </div>
        <div className="rc-rise" style={{ animationDelay: '3.1s' }}>
          <button
            className="inline-flex h-14 cursor-pointer items-center gap-2.5 rounded-full bg-ink px-9 text-[17px] font-semibold text-on-ink"
            onClick={onDone}
          >
            Back to work
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </main>
  );
}

/** What recharged the battery, for the eyebrow above "Recharged." */
export function rechargedEyebrow(kind: 'mission' | 'away' | 'gap' | 'skipped'): string | undefined {
  if (kind === 'away') return 'While you were away';
  if (kind === 'gap') return 'Chrome was closed · You moved';
  return undefined;
}
