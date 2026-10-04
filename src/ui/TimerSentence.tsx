import { useEffect, useRef, useState } from 'react';
import calendar from '@/assets/emoji/calendar.png';
import { send, setCalendar } from '@/data/client';
import type { Settings } from '@/engine';
import { timeOfDay } from './format';

type Field = 'intervalMin' | 'dayStart' | 'dayEnd' | 'lunchStart' | 'lunchEnd';

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
    token: 'rounded-[14px] leading-[56px]',
    value: 'px-3.5',
    arrow: 'w-9',
    hint: 'text-center',
    card: 'w-[880px] rounded-panel bg-raised px-6 py-5',
    cardIcon: 'size-14',
  },
  /** Inside a setup step: left-aligned, in a narrower column. */
  small: {
    wrap: 'items-start gap-4',
    text: 'text-[24px] leading-[42px]',
    token: 'rounded-[10px] leading-[34px]',
    value: 'px-2.5',
    arrow: 'w-6',
    hint: '',
    card: 'w-full rounded-[20px] bg-band px-4 py-3.5',
    cardIcon: 'size-10',
  },
};

/**
 * The movement timer as one sentence. Every highlighted word is changed in place: scroll over it,
 * or click it and use its arrows or the arrow keys.
 */
export function TimerSentence({ settings: saved, size = 'large' }: { settings: Settings; size?: keyof typeof SIZES }) {
  const [edit, setEdit] = useState<Field | null>(null);
  const [calendarError, setCalendarError] = useState<string>();
  const [busy, setBusy] = useState(false);
  // What was just picked shows at once, without waiting for the background to answer
  const [picked, setPicked] = useState<Partial<Settings>>({});
  const scrolled = useRef(0);
  const settings = { ...saved, ...picked };
  const look = SIZES[size];

  const change = (patch: Partial<Settings>) => {
    setPicked((p) => ({ ...p, ...patch }));
    void send({ type: 'settings', patch });
  };
  /** Moves a field to its previous or next allowed value. */
  const step = (field: Field, by: number) => {
    const values = options(field, settings);
    const value = values[Math.max(0, Math.min(values.length - 1, values.indexOf(settings[field]) + by))];
    if (value != null && value !== settings[field]) change({ [field]: value });
  };
  const move = useRef(step);
  move.current = step;

  useEffect(() => {
    if (!edit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') move.current(edit, -1);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') move.current(edit, 1);
      else if (e.key === 'Enter' || e.key === 'Escape') setEdit(null);
      else return;
      e.preventDefault();
    };
    // A click anywhere else puts the word back to rest
    const onDown = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.('[data-token]')) setEdit(null);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [edit]);

  const token = (field: Field) => {
    const on = edit === field;
    const values = options(field, settings);
    const index = values.indexOf(settings[field]);
    return (
      <span
        data-token
        className={`inline-flex items-center align-top ${size === 'large' ? 'mt-2' : 'mt-1'} ${look.token} ${on ? 'bg-ink text-on-ink' : 'bg-pill text-ink'}`}
        onWheel={(e) => {
          scrolled.current += e.deltaY + e.deltaX;
          if (Math.abs(scrolled.current) < 40) return;
          step(field, scrolled.current > 0 ? 1 : -1);
          scrolled.current = 0;
        }}
      >
        {on && <Arrow label="Previous value" d="m15 18-6-6 6-6" width={look.arrow} disabled={index <= 0} onClick={() => step(field, -1)} />}
        <button
          aria-label={`${LABELS[field]}, ${show(field, settings[field])}`}
          aria-expanded={on}
          className={`cursor-pointer rounded-[inherit] ${on ? '' : look.value}`}
          onClick={() => setEdit(on ? null : field)}
        >
          {show(field, settings[field])}
        </button>
        {on && (
          <Arrow label="Next value" d="m9 18 6-6-6-6" width={look.arrow} disabled={index >= values.length - 1} onClick={() => step(field, 1)} />
        )}
      </span>
    );
  };
  const days = settings.days === 'every' ? 'every day' : 'on weekdays';
  const toggleCalendar = async (connect: boolean) => {
    setBusy(true);
    setCalendarError(await setCalendar(connect));
    setBusy(false);
  };

  return (
    <div className={`flex w-full flex-col ${look.wrap}`}>
      <p className={`m-0 font-bold tracking-[-0.02em] text-ink-2 ${look.text}`}>
        Remind me to move every {token('intervalMin')}, from {token('dayStart')} to {token('dayEnd')},{' '}
        <button
          aria-label={`Days, ${days}. Switch`}
          className={`inline-flex cursor-pointer items-center bg-pill align-top text-ink ${size === 'large' ? 'mt-2' : 'mt-1'} ${look.token} ${look.value}`}
          onClick={() => change({ days: settings.days === 'every' ? 'weekdays' : 'every' })}
        >
          {days}
        </button>
        . Not during lunch, from {token('lunchStart')} to {token('lunchEnd')}
        {saved.calendar && (
          <>
            , or during <span className="text-ink">my Google meetings</span>
          </>
        )}
        .
      </p>

      <div className={`text-[15px] leading-5 text-ink-2 ${look.hint}`}>
        {edit ? 'Scroll, or use the arrows. Click elsewhere when you are done.' : 'Scroll over a highlighted word, or click it, to change it.'}
      </div>

      {/* Meetings: always visible, so connecting the calendar is not hidden behind a word */}
      <section aria-label="Meetings" className={`flex flex-col gap-3 border border-line ${look.card}`}>
        <div className="flex items-center gap-4">
          <img src={calendar} alt="" className={`shrink-0 ${look.cardIcon}`} />
          <div className="flex min-w-0 grow flex-col gap-0.5 text-left">
            <span className="text-[17px] leading-6 font-semibold text-ink">Protect my meetings</span>
            <span className="text-[15px] leading-5 text-ink-2">
              {saved.calendar ? 'No prompts while you are in a meeting.' : 'You will never be prompted during your meetings.'}
            </span>
          </div>
          {saved.calendar ? (
            <>
              <span className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-pos-bg px-4 text-[15px] font-semibold whitespace-nowrap text-pos">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Connected
              </span>
              <button
                disabled={busy}
                className="h-11 shrink-0 cursor-pointer px-1 text-[15px] text-ink-2 underline underline-offset-[3px]"
                onClick={() => void toggleCalendar(false)}
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              disabled={busy}
              className="h-12 shrink-0 cursor-pointer rounded-full bg-pill px-5 text-[15px] font-semibold whitespace-nowrap text-ink"
              onClick={() => void toggleCalendar(true)}
            >
              Connect Google Calendar
            </button>
          )}
        </div>
        {calendarError && (
          <div role="alert" className="text-left text-[15px] leading-5 text-att">
            {calendarError}
          </div>
        )}
      </section>
    </div>
  );
}

function Arrow({ label, d, width, disabled, onClick }: { label: string; d: string; width: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      className={`flex shrink-0 items-center justify-center self-stretch rounded-[inherit] ${width} ${disabled ? 'opacity-30' : 'cursor-pointer'}`}
      onClick={onClick}
    >
      <svg width="0.5em" height="0.5em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </button>
  );
}
