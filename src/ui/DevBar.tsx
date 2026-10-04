import { browser } from 'wxt/browser';
import { batteryLevel, type Input, type State } from '@/engine';
import type { Message } from '@/data/client';

const message = (m: Message) => void browser.runtime.sendMessage(m);
const act = (input: Input) => message({ mb: 'dispatch', input });
const advance = (min: number) => message({ mb: 'dev_advance', ms: min * 60_000 });

async function reset() {
  await browser.storage.local.clear();
  await indexedDB.deleteDatabase('micro.breaks');
  browser.runtime.reload();
}

const time = (ts: number | null) =>
  ts == null ? '–' : new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Test mode, dev builds only: plays time forward and fakes stepping away. Never in the built extension. */
export function DevBar({ state, now }: { state: State; now: number }) {
  if (!import.meta.env.DEV) return null;
  const b = state.break;
  const facts = [
    `clock ${time(now)}`,
    state.setupDone ? `battery ${Math.round(batteryLevel(state, now))}%` : 'setup not done',
    `next break ${time(state.dueAt)}`,
    b ? `break: ${b.phase}` : 'no break',
    state.idle,
  ];
  const button = 'h-7 cursor-pointer rounded-full bg-pill px-3 text-[13px] font-medium text-ink';

  return (
    <aside className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center gap-2 border-t border-line bg-raised px-4 py-2 text-[13px] text-ink-2">
      <strong className="text-ink">Test mode</strong>
      <span>{facts.join(' · ')}</span>
      <span className="ml-auto flex flex-wrap gap-2">
        {!state.setupDone && (
          <button className={button} onClick={() => act({ type: 'setup_done' })}>
            Finish setup
          </button>
        )}
        {[1, 5, 25, 55].map((min) => (
          <button key={min} className={button} onClick={() => advance(min)}>
            +{min} min
          </button>
        ))}
        {state.idle === 'active' ? (
          <button className={button} onClick={() => act({ type: 'idle', state: 'locked' })}>
            Step away
          </button>
        ) : (
          <button className={button} onClick={() => act({ type: 'idle', state: 'active' })}>
            Come back
          </button>
        )}
        <a className={`${button} inline-flex items-center no-underline`} href="/videos.html">
          Videos
        </a>
        <button className={button} onClick={() => void reset()}>
          Reset
        </button>
      </span>
    </aside>
  );
}
