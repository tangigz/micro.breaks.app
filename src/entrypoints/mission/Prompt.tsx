import { useEffect } from 'react';
import { send } from '@/data/client';
import { type Break, mission, type State } from '@/engine';
import { missionArt } from '@/ui/missionArt';

/** "Time to move." One mission, one primary pill, Enter to start. The only exit is a quiet link that costs effort. */
export function Prompt({ state, b }: { state: State; b: Break }) {
  const m = mission(b.missionId);
  const art = missionArt(m);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      void send({ type: 'start_mission' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <main className="relative grid w-[1120px] grow grid-cols-[minmax(0,1fr)_440px] items-center gap-20 pb-14">
      {/* Left: headline and the only ways forward */}
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-5">
          <h1 className="m-0 text-[120px] leading-[112px] font-bold tracking-[-0.045em]">Time to move.</h1>
          <div
            role="status"
            className="inline-flex h-9 items-center gap-2 self-start rounded-full bg-raised pr-3.5 pl-3 text-[15px] leading-5 font-medium"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              className="stroke-att"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <span>Chrome is locked until you move.</span>
          </div>
        </div>

        <div className="flex flex-col items-start gap-5">
          <div className="flex items-center gap-3">
            <button
              className="inline-flex h-14 cursor-pointer items-center gap-2.5 rounded-full bg-ink px-9 text-[17px] font-semibold text-on-ink"
              onClick={() => void send({ type: 'start_mission' })}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="7 4 19 12 7 20 7 4" />
              </svg>
              Start mission
            </button>
            {b.switched ? (
              <button
                disabled
                aria-label="Switched. One switch per break."
                className="flex h-14 cursor-not-allowed items-center gap-2 rounded-full border border-line-2 px-[22px] text-[15px] font-medium text-ink-2"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Switched
              </button>
            ) : (
              <button
                className="flex h-14 cursor-pointer items-center gap-2 rounded-full bg-pill px-[22px] text-[15px] font-medium text-ink"
                onClick={() => void send({ type: 'switch_mission' })}
              >
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
                  <path d="M16 3h5v5" />
                  <path d="M4 20 21 3" />
                  <path d="M21 16v5h-5" />
                  <path d="m15 15 6 6" />
                  <path d="m4 4 5 5" />
                </svg>
                Switch mission
              </button>
            )}
          </div>
          {b.voluntary ? (
            // A break started with "Start a break now" is free to cancel until the mission starts
            <button
              className="inline-flex min-h-11 cursor-pointer items-center text-[15px] leading-5 text-ink-2 underline underline-offset-[3px]"
              onClick={() => void send({ type: 'cancel_break' })}
            >
              Not now
            </button>
          ) : (
            <button
              className="inline-flex min-h-11 cursor-pointer items-center text-[15px] leading-5 text-ink-2 underline underline-offset-[3px]"
              onClick={() => void send({ type: 'skip_open' })}
            >
              Skip (it'll cost you)
            </button>
          )}
        </div>
      </div>

      {/* Right: the one mission */}
      <section aria-label="Your mission" className="flex w-[499px] flex-col gap-6 rounded-panel bg-raised p-6">
        <div className={`flex h-[264px] items-center justify-center rounded-row ${art.tile}`}>
          <img className="tile-float size-[200px]" src={art.img} alt="" />
        </div>
        <div className="flex flex-col gap-2 px-2 pb-2">
          <div className="text-[13px] leading-4 font-medium tracking-[0.08em] text-ink-2 uppercase">
            Your mission{m.videos ? '' : ` · ${state.settings.missionLengthMin} min`}
          </div>
          <div className="text-[44px] leading-[48px] font-bold tracking-[-0.02em]">{m.name}</div>
          <div className="text-[17px] leading-6 text-ink-2">{m.cue}</div>
        </div>
      </section>
    </main>
  );
}
