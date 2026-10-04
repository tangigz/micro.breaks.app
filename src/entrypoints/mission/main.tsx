import { useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { missionView } from '@/engine';
import { send, useEngine } from '@/data/client';
import { DevBar } from '@/ui/DevBar';
import { Frame } from '@/ui/Frame';
import { Header } from '@/ui/Header';
import { Recharged, rechargedEyebrow } from '@/ui/Recharged';
import { applySavedTheme, applyTheme } from '@/ui/theme';
import '@/ui/tokens.css';
import { Prompt } from './Prompt';
import { Running } from './Running';

applySavedTheme();

const headline = 'm-0 text-[104px] leading-[100px] font-bold tracking-[-0.045em]';
const primary = 'h-14 w-fit cursor-pointer rounded-full bg-ink px-9 text-[17px] font-semibold text-on-ink';

/** Back to work: this tab has done its job. Close it, unless it is the only one in the window. */
async function backToWork(): Promise<void> {
  await send({ type: 'outcome_seen' });
  const [tab, all] = await Promise.all([browser.tabs.getCurrent(), browser.tabs.query({ currentWindow: true })]);
  if (tab?.id != null && all.length > 1) await browser.tabs.remove(tab.id);
  else location.replace('/newtab.html');
}

function Mission() {
  const engine = useEngine();
  const theme = engine?.state.settings.theme;
  const b = engine?.state.break;
  const outcome = engine?.state.outcome;
  // Nothing to show here once the break is over and its outcome has been seen
  const leave = engine != null && !b && !outcome;
  const done = useCallback(() => void backToWork(), []);

  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (leave) location.replace('/newtab.html');
  }, [leave]);

  if (!engine || leave) return null;
  const { state, now } = engine;
  const timer = missionView(state, now);
  const prompt = b?.phase === 'prompt' && !b.skip;

  return (
    <Frame>
      {/* Warm prompt glow, top right */}
      {prompt && (
        <div
          aria-hidden="true"
          className="absolute -top-[200px] -right-[200px] size-[1000px] rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(255,160,90,.30), rgba(255,160,90,0))' }}
        />
      )}
      <Header theme={state.settings.theme}>
        {prompt && (
          <span className="flex items-center gap-1.5 text-[13px] leading-4 font-medium text-ink-2">
            <kbd className="inline-flex h-6 items-center rounded-md border border-line-2 px-1.5 font-sans text-ink">Enter</kbd>
            Start mission
          </span>
        )}
      </Header>

      {b?.skip ? (
        // Placeholder until the skip challenge (#8) is designed in
        <main className="relative flex w-[1120px] grow flex-col justify-center gap-6 pb-14">
          <h1 className={headline}>Skipping costs more than moving.</h1>
          <button className={primary} onClick={() => void send({ type: 'skip_cancel' })}>
            Fine, I'll do the mission
          </button>
        </main>
      ) : b && prompt ? (
        <Prompt state={state} b={b} />
      ) : b && timer ? (
        <Running b={b} timer={timer} />
      ) : outcome?.kind === 'skipped' ? (
        <main className="relative flex w-[1120px] grow flex-col justify-center gap-6 pb-14">
          <h1 className={headline}>Skipped.</h1>
          <button className={primary} onClick={done}>
            Back to work
          </button>
        </main>
      ) : outcome ? (
        <Recharged eyebrow={rechargedEyebrow(outcome.kind)} onDone={done} />
      ) : null}
      <DevBar {...engine} />
    </Frame>
  );
}

createRoot(document.getElementById('root')!).render(<Mission />);
