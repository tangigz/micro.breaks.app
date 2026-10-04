import { useEffect, useRef, useState } from 'react';
import { send } from '@/data/client';
import { type MathsChallenge, SENTENCES, type State, type TypeChallenge } from '@/engine';
import { timeAt } from '@/ui/format';

const eyebrow = 'text-[13px] leading-4 font-medium tracking-[0.08em] uppercase';

/** Coral halo: the battery is empty and stays empty. */
function Halo() {
  return (
    <div
      aria-hidden="true"
      className="absolute top-[378px] left-[270px] -mt-[550px] -ml-[550px] size-[1100px] rounded-full"
      style={{ background: 'radial-gradient(closest-side, rgba(255,138,91,.22), rgba(255,138,91,0))' }}
    />
  );
}

function Maths({ c }: { c: MathsChallenge }) {
  const [value, setValue] = useState('');
  const field = useRef<HTMLInputElement>(null);

  // A new question starts with an empty field
  useEffect(() => {
    setValue('');
    field.current?.focus();
  }, [c.question]);

  const check = () => {
    const answer = parseFloat(value.replace(',', '.'));
    if (!Number.isNaN(answer)) void send({ type: 'skip_answer', value: answer });
  };
  const again = () => void send({ type: 'skip_retry' });

  return (
    <section aria-label="Maths challenge" className="flex flex-col gap-7 rounded-panel bg-raised p-8">
      <div className="flex items-center justify-between">
        <span className={`${eyebrow} text-ink-2`}>
          Question {c.streak + 1} of {c.need}
        </span>
        <span aria-hidden="true" className="flex gap-1.5">
          {Array.from({ length: c.need }, (_, i) => (
            <span key={i} className={`h-2.5 w-8 rounded-full ${i < c.streak ? 'bg-pos' : 'bg-pill'}`} />
          ))}
        </span>
      </div>
      <div className="text-[80px] leading-[88px] font-bold tracking-[-0.045em] whitespace-nowrap">{c.question}</div>
      <div className="flex flex-col gap-2.5">
        <label htmlFor="skip-answer" className="text-[15px] leading-5 text-ink-2">
          Your answer
        </label>
        <div className="flex items-center gap-3">
          <input
            id="skip-answer"
            ref={field}
            value={value}
            inputMode="decimal"
            placeholder="?"
            autoComplete="off"
            readOnly={c.wrong}
            aria-invalid={c.wrong}
            className={`h-[72px] min-w-0 grow rounded-row border-2 bg-bg px-6 text-[40px] font-bold tracking-[-0.02em] text-ink outline-offset-2 ${c.wrong ? 'border-att' : 'border-line-2'}`}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.stopPropagation();
              if (c.wrong) again();
              else check();
            }}
          />
          <button
            className="h-[72px] shrink-0 cursor-pointer rounded-row bg-pill px-7 text-[17px] font-semibold text-ink"
            onClick={c.wrong ? again : check}
          >
            {c.wrong ? 'Start again' : 'Check'}
          </button>
        </div>
      </div>
      <div className="flex min-h-12 items-center">
        {c.wrong && (
          <div role="alert" className="flex min-h-12 items-center gap-3 rounded-full bg-att-bg px-5 py-3 text-[17px] leading-6">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="stroke-att" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            <b className="font-semibold">Wrong. Back to zero.</b>
          </div>
        )}
      </div>
    </section>
  );
}

function Typing({ c }: { c: TypeChallenge }) {
  const [typed, setTyped] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const sentence = SENTENCES[c.sentences[c.done]!]!;
  const second = c.sentences.length > 1;

  useEffect(() => {
    setTyped('');
    field.current?.focus();
  }, [sentence]);

  // Correct characters turn green; the first mistake blocks progress
  let ok = 0;
  while (ok < typed.length && ok < sentence.length && typed[ok] === sentence[ok]) ok++;
  const mistake = typed.length > ok;

  const onChange = (text: string) => {
    setTyped(text);
    if (text === sentence) void send({ type: 'skip_sentence', text });
  };

  return (
    <section aria-label="Typing challenge" className="flex flex-col gap-7 rounded-panel bg-raised p-8">
      <div className={`flex items-center justify-between ${eyebrow} text-ink-2`}>
        <span>{second ? `Sentence ${c.done + 1} of 2` : 'The sentence'}</span>
        <span>
          {ok} / {sentence.length}
        </span>
      </div>
      <p aria-label={sentence} className="m-0 text-[36px] leading-[46px] font-bold tracking-[-0.02em] whitespace-pre-wrap select-none">
        <span className="text-pos">{sentence.slice(0, ok)}</span>
        {mistake && <span className="rounded-md bg-att-bg text-att underline underline-offset-[6px]">{sentence[ok]}</span>}
        <span>{sentence.slice(ok + (mistake ? 1 : 0))}</span>
      </p>
      <div className="flex flex-col gap-2.5">
        <label htmlFor="skip-typed" className="text-[15px] leading-5 text-ink-2">
          Type it exactly. No pasting.
        </label>
        <input
          id="skip-typed"
          ref={field}
          value={typed}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={mistake}
          className={`h-16 rounded-row border-2 bg-bg px-5 text-[20px] font-medium text-ink outline-offset-2 ${mistake ? 'border-att' : 'border-line-2'}`}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
          onKeyDown={(e) => e.key === 'Enter' && e.stopPropagation()}
        />
      </div>
      <div role={mistake ? 'alert' : undefined} className={`min-h-6 text-[15px] leading-5 ${mistake ? 'text-att' : 'text-ink-2'}`}>
        {mistake ? 'One wrong character. Fix it to continue.' : 'Capitals and punctuation count.'}
      </div>
    </section>
  );
}

/** "Skipping costs more than moving." The only way out of a break, and it takes effort. */
export function Skip({ c }: { c: MathsChallenge | TypeChallenge }) {
  const second = c.kind === 'maths' ? c.need > 3 : c.sentences.length > 1;
  const rule =
    c.kind === 'type'
      ? second
        ? 'Second skip today. Two sentences this time.'
        : 'Type it exactly. No pasting.'
      : second
        ? 'Second skip today. 5 in a row this time.'
        : 'Answer these questions to unlock Chrome';

  return (
    <main className="relative grid w-[1120px] grow grid-cols-[minmax(0,1fr)_520px] items-center gap-[72px] pb-[72px]">
      <Halo />
      {/* Left: the price, and the way back */}
      <div className="relative flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <div className={`${eyebrow} text-neg`}>Skip challenge{second ? ' · Second skip today' : ''}</div>
          <h1 className="m-0 text-[72px] leading-[72px] font-bold tracking-[-0.04em]">Skipping costs more than moving.</h1>
          <div className="text-[22px] leading-[28px] font-semibold tracking-[-0.01em] text-ink-2">{rule}</div>
        </div>
        <button
          className="inline-flex h-14 w-fit cursor-pointer items-center gap-2.5 rounded-full bg-ink px-8 text-[17px] font-semibold text-on-ink"
          onClick={() => void send({ type: 'skip_cancel' })}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          Fine, I'll do the mission
        </button>
      </div>

      <div className="relative">{c.kind === 'maths' ? <Maths c={c} /> : <Typing c={c} />}</div>
    </main>
  );
}

/** "Skipped." Chrome is unlocked, the battery stays empty. */
export function Skipped({ state, onDone }: { state: State; onDone: () => void }) {
  return (
    <main className="relative grid w-[1120px] grow grid-cols-[420px_minmax(0,1fr)] items-center gap-20 pb-[72px]">
      <Halo />
      <div className="relative flex flex-col items-center gap-1.5">
        <div className="h-4 w-[72px] rounded-t-[10px] bg-ink" />
        <div
          role="img"
          aria-label="Battery empty, the break was skipped"
          className="flex h-[440px] w-[220px] flex-col justify-end rounded-[48px] border-[6px] border-ink p-3"
        >
          <div className="h-6 w-full rounded-[32px] bg-[#FF8A5B]" />
        </div>
      </div>
      <div className="relative flex flex-col gap-10">
        <div className="flex flex-col gap-3.5">
          <div className={`${eyebrow} text-neg`}>Challenge passed · Chrome is unlocked</div>
          <h1 className="m-0 text-[104px] leading-[100px] font-bold tracking-[-0.045em]">Skipped.</h1>
          <div className="text-[28px] leading-[34px] font-bold tracking-[-0.015em] text-ink-2">
            Your battery stays empty.
            {state.dueAt != null && (
              <>
                <br />
                Next break at <span className="text-ink">{timeAt(state.dueAt)}</span>.
              </>
            )}
          </div>
        </div>
        <div>
          <button
            autoFocus
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
