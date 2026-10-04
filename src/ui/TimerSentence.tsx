import { useEffect, useRef, useState } from 'react';
import calendar from '@/assets/emoji/calendar.png';
import { send, setCalendar } from '@/data/client';
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
    icon: 'size-9',
    meet: 'mt-2',
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
    icon: 'size-6',
    meet: 'mt-[5px]',
  },
};

/** The movement timer as one sentence. Every highlighted word opens a tray of values under it. */
export function TimerSentence({ settings: saved, size = 'large' }: { settings: Settings; size?: keyof typeof SIZES }) {
  const [edit, setEdit] = useState<Field | null>(null);
  /** The calendar tray, under the same sentence. */
  const [meetings, setMeetings] = useState(false);
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
      onClick={() => {
        setMeetings(false);
        setEdit(edit === field ? null : field);
      }}
    >
      {show(field, settings[field])}
    </button>
  );
  const days = settings.days === 'every' ? 'every day' : 'on weekdays';
  const meetLabel = saved.calendar ? 'my Google meetings' : 'meetings';
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
          className={`cursor-pointer bg-pill text-ink ${look.token}`}
          onClick={() => change({ days: settings.days === 'every' ? 'weekdays' : 'every' })}
        >
          {days}
        </button>
        . Not during lunch, from {token('lunchStart')} to {token('lunchEnd')}, or during{' '}
        <button
          aria-label={`Meetings, ${meetLabel}`}
          aria-expanded={meetings}
          className={`inline-flex cursor-pointer items-center gap-2 align-top ${look.token} ${look.meet} ${meetings ? 'bg-ink text-on-ink' : 'bg-pill text-ink'}`}
          onClick={() => {
            setEdit(null);
            setMeetings(!meetings);
          }}
        >
          <img src={calendar} alt="" className={look.icon} />
          {meetLabel}
        </button>
        .
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
        ) : meetings ? (
          // Calendar: Google Calendar only
          <section aria-label="Calendar" className={`flex flex-wrap items-center border border-line bg-raised ${look.tray} ${size === 'large' ? 'p-6' : ''}`}>
            <div className="flex w-full items-center gap-4">
              <img src={calendar} alt="" className="size-14 shrink-0" />
              <div className="flex min-w-0 grow flex-col gap-0.5">
                <span className="text-[17px] leading-6 font-semibold">Skip my meetings</span>
                <span className="text-[15px] leading-5 text-ink-2">
                  {saved.calendar
                    ? 'No prompts while you are in a meeting.'
                    : 'Connect Google Calendar so prompts wait until your meeting ends. Read-only, busy times only.'}
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
                  className="h-12 shrink-0 cursor-pointer rounded-full bg-ink px-6 text-[15px] font-semibold whitespace-nowrap text-on-ink"
                  onClick={() => void toggleCalendar(true)}
                >
                  Connect Google Calendar
                </button>
              )}
              <button
                className="h-12 shrink-0 cursor-pointer rounded-full bg-pill px-5 text-[15px] font-medium text-ink"
                onClick={() => setMeetings(false)}
              >
                Close
              </button>
            </div>
            {calendarError && (
              <div role="alert" className="mt-3 w-full text-[15px] leading-5 text-att">
                {calendarError}
              </div>
            )}
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
