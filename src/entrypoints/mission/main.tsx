import { createRoot } from 'react-dom/client';
import { mission, missionView } from '@/engine';
import { send, useEngine } from '@/data/client';
import '@/ui/tokens.css';

/** Placeholder until the prompt (#6) and the mission timer (#7) are designed in. */
function Mission() {
  const engine = useEngine();
  if (!engine) return null;
  const { state, now } = engine;
  const b = state.break;
  const timer = missionView(state, now);
  const left = timer ? Math.ceil(timer.remainingMs / 1000) : 0;

  return (
    <main className="mx-auto flex max-w-[1120px] flex-col gap-6 px-10 py-24">
      <h1 className="text-[104px] leading-[100px] font-bold tracking-[-0.045em]">
        {b ? 'Time to move.' : state.outcome?.kind === 'skipped' ? 'Skipped.' : state.outcome ? 'Recharged.' : 'No break.'}
      </h1>
      {b && (
        <p className="text-[22px] leading-[28px] font-semibold text-ink-2">
          {mission(b.missionId).name}
          {timer && ` · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}${timer.running ? '' : ' · paused'}`}
        </p>
      )}
      {b?.phase === 'prompt' && (
        <button
          className="h-14 w-fit cursor-pointer rounded-full bg-ink px-9 text-[17px] font-semibold text-on-ink"
          onClick={() => void send({ type: 'start_mission' })}
        >
          Start mission
        </button>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Mission />);
