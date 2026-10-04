const pad = (v: number) => String(v).padStart(2, '0');

/** A countdown: 17:50. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

/** A length of time: 42 min, 1 h 08. */
export function duration(ms: number): string {
  const min = Math.floor(ms / 60_000);
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${pad(min % 60)}` : `${min} min`;
}

/** A time of day from minutes since midnight: 9:00. */
export function timeOfDay(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
}

/** A time of day from a timestamp: 11:30. */
export function timeAt(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours()}:${pad(d.getMinutes())}`;
}

export function weekday(ts: number): string {
  return new Date(ts).toLocaleDateString('en', { weekday: 'long' });
}
