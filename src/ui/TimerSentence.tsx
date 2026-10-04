import { useEffect, useRef, useState } from 'react';
import { send } from '@/data/client';
import type { Settings } from '@/engine';
import { timeOfDay } from './format';

type Field = 'intervalMin' | 'dayStart' | 'dayEnd' | 'lunchStart' | 'lunchEnd';

const TITLES: Record<Field, string> = {
  intervalMin: 'Remind me every',
  dayStart: 'Start of your day',
  dayEnd: 'End of your day',
  lunchStart: 'Lunch starts',
  lunchEnd: 'Lunch ends',
};

const LABELS: Record<Field, string> = {
  intervalMin: 'Interval',
  dayStart: 'Start of day',
  dayEnd: 'End of day',
  lunchStart: 'Lunch starts',
  lunchEnd: 'Lunch ends',
};

const INTERVALS = [30, 45, 60, 75, 90];
const TIMES = Array.from({ length: (22 - 6) * 4 + 1 }, (_, i) => 6 * 60 + i * 15);

/** The values a field can take. Times keep their order: start, lunch start, lunch end, end. */
function options(field: Field, s: Settings): number[] {
  switch (field) {
    case 'intervalMin':
      return INTERVALS;
    case 'dayStart':
      return TIMES.filter((t) => t <= s.lunchStart);
    case 'lunchStart':
      return TIMES.filter((t) => t >= s.dayStart && t < s.lunchEnd);
    case 'lunchEnd':
      return TIMES.filter((t) => t > s.lunchStart && t <= s.dayEnd);
    case 'dayEnd':
      return TIMES.filter((t) => t >= s.lunchEnd);
  }
}

const show = (field: Field, value: number) => (field === 'intervalMin' ? `${value} min` : timeOfDay(value));

const SIZES = {
  /** The movement timer screen: the sentence is the whole page, centred. */
  large: {
    wrap: 'items-center gap-8',
    text: 'text-center text-[44px] leading-[72px]',
    token: 'rounded-[14px] px-3.5 leading-[56px]',
    tray: 'w-[880px] gap-4 rounded-panel px-6 py-5',
    hold: 'min-h-[124px] items-center',
    cell: 'h-14 rounded-[14px]',
    values: ['text-[28px] font-bold', 'text-[22px] font-medium', 'text-[18px] font-medium'],
    hint: 'text-center',
  },
  /** Inside a setup step: left-aligned, in a 570 px column. */
  small: {
    wrap: 'items-start gap-4',
    text: 'text-[24px] leading-[44px]',
    token: 'rounded-[10px] px-2.5 leading-[34px]',
    tray: 'w-full gap-3 rounded-[20px] bg-band px-4 py-4',
    hold: 'items-start',
    cell: 'h-11 rounded-xl',
    values: ['text-[18px] font-bold', 'text-[15px] font-medium', 'text-[13px] font-medium'],
    hint: '',
  },
};

/** The movement timer as one sentence. Every highlighted word opens a tray of values under it. */
export function TimerSentence({ settings: saved, size = 'large' }: { settings: Settings; size?: keyof typeof SIZES }) {
  const [edit, setEdit] = useState<Field | null>(null);
  // What was just picked shows at once, without waiting for the background to answer
  const [picked, setPicked] = useState<Partial<Settings>>({});
  const scrolled = useRef(0);
  const settings = { ...saved, ...picked };
  const look = SIZES[size];

  const change = (patch: Partial<Settings>) => {
    setPicked((p) => ({ ...p, ...patch }));
    void send({ type: 'settings', patch });
  };
  const values = edit ? options(edit, settings) : [];
  const index = edit ? values.indexOf(settings[edit]) : -1;
  const pick = (i: number) => {
    const value = values[Math.max(0, Math.min(values.length - 1, i))];
    if (edit && value != null && value !== settings[edit]) change({ [edit]: value });
  };
  const move = useRef<(by: number) => void>(() => {});
  move.current = (by) => pick(index + by);

  useEffect(() => {
    if (!edit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') move.current(-1);
      else if (e.key === 'ArrowRight') move.current(1);
      else if (e.key === 'Enter' || e.key === 'Escape') setEdit(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [edit]);

  const token = (field: Field) => (
    <button
      aria-label={`${LABELS[field]}, ${show(field, settings[field])}`}
      aria-expanded={edit === field}
      className={`cursor-pointer ${look.token} ${edit === field ? 'bg-ink text-on-ink' : 'bg-pill text-ink'}`}
      onClick={() => setEdit(edit === field ? null : field)}
    >
      {show(field, settings[field])}
    </button>
  );
  const days = settings.days === 'every' ? 'every day' : 'on weekdays';

  return (
    <div className={`flex w-full flex-col ${look.wrap}`}>
      <p className={`m-0 font-bold tracking-[-0.02em] text-ink-2 ${look.text}`}>
        Remind me to move every {token('intervalMin')}, from {token('dayStart')} to {token('dayEnd')},{' '}
        <button
          aria-label={`Days, ${days}. Switch`}
          className={`cursor-pointer bg-pill text-ink ${look.token}`}
          onClick={() => change({ days: settings.days === 'every' ? 'weekdays' : 'every' })}
        >
          {days}
        </button>
        . Not during lunch, from {token('lunchStart')} to {token('lunchEnd')}.
      </p>

      {/* Tray under the sentence */}
      <div className={`flex w-full flex-col ${look.hold}`}>
        {edit ? (
          <section
            aria-label={TITLES[edit]}
            className={`flex flex-col border border-line bg-raised ${look.tray}`}
            onWheel={(e) => {
              scrolled.current += e.deltaY + e.deltaX;
              if (Math.abs(scrolled.current) >= 40) {
                move.current(scrolled.current > 0 ? 1 : -1);
                scrolled.current = 0;
              }
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[17px] leading-6 font-semibold">{TITLES[edit]}</span>
              <span className="text-[13px] leading-4 font-medium text-ink-2">Scroll or ← →</span>
            </div>
            <div className="flex items-center gap-2">
              <Arrow label="Previous value" d="m15 18-6-6 6-6" cell={look.cell} onClick={() => pick(index - 1)} />
              <div role="listbox" aria-label={TITLES[edit]} className="grid grow grid-cols-5 gap-1">
                {[-2, -1, 0, 1, 2].map((d) => {
                  const value = values[index + d];
                  const text = look.values[Math.abs(d)]!;
                  return (
                    <button
                      key={d}
                      role="option"
                      aria-selected={d === 0}
                      disabled={value == null}
                      className={`whitespace-nowrap ${look.cell} ${text} ${d === 0 ? 'bg-pill text-ink' : 'text-ink-2'} ${value == null ? '' : 'cursor-pointer'}`}
                      onClick={() => pick(index + d)}
                    >
                      {value == null ? '' : show(edit, value)}
                    </button>
                  );
                })}
              </div>
              <Arrow label="Next value" d="m9 18 6-6-6-6" cell={look.cell} onClick={() => pick(index + 1)} />
              <button
                className={`shrink-0 cursor-pointer bg-ink px-6 text-[15px] font-semibold text-on-ink ${look.cell}`}
                onClick={() => setEdit(null)}
              >
                Done
              </button>
            </div>
          </section>
        ) : (
          <div className={`text-[15px] leading-5 text-ink-2 ${look.hint}`}>Click any highlighted word to change it.</div>
        )}
      </div>
    </div>
  );
}

function Arrow({ label, d, cell, onClick }: { label: string; d: string; cell: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      className={`flex w-11 shrink-0 cursor-pointer items-center justify-center bg-pill ${cell}`}
      onClick={onClick}
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
        <path d={d} />
      </svg>
    </button>
  );
}
