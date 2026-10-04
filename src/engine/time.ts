import type { Settings } from './types';

export const MIN = 60_000;

export function dayKey(now: number): string {
  const d = new Date(now);
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function minuteOfDay(now: number): number {
  const d = new Date(now);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/** Timestamp of a time of day (minutes since midnight) on the local day of `now`. */
export function tsAt(now: number, minutes: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime() + minutes * MIN;
}

export function isWorkingDay(settings: Settings, now: number): boolean {
  if (settings.days === 'every') return true;
  const dow = new Date(now).getDay();
  return dow >= 1 && dow <= 5;
}

export function inLunch(settings: Settings, now: number): boolean {
  const m = minuteOfDay(now);
  return m >= settings.lunchStart && m < settings.lunchEnd;
}

/** Inside working hours on a working day, and not at lunch: the only time the seated timer runs. */
export function inWindow(settings: Settings, now: number): boolean {
  const m = minuteOfDay(now);
  return isWorkingDay(settings, now) && m >= settings.dayStart && m < settings.dayEnd && !inLunch(settings, now);
}
