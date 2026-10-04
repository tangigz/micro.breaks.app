import { browser } from 'wxt/browser';
import type { Busy } from '@/engine/calendar';

const BUSY_KEY = 'calendarBusy';
/** Browser tests: busy blocks used in place of Google, so no account is needed. */
const TEST_KEY = 'testCalendar';
const FREE_BUSY = 'https://www.googleapis.com/calendar/v3/freeBusy';
/** How far ahead busy times are fetched. Longer than the 5-min poll by a wide margin. */
const AHEAD_MS = 12 * 60 * 60_000;

export const CALENDAR_ALARM = 'calendar';

async function testBusy(): Promise<Busy[] | undefined> {
  return (await browser.storage.local.get(TEST_KEY))[TEST_KEY] as Busy[] | undefined;
}

function configured(): boolean {
  return !!browser.runtime.getManifest().oauth2?.client_id;
}

async function token(interactive: boolean): Promise<string> {
  const result = await browser.identity.getAuthToken({ interactive });
  const value = typeof result === 'string' ? result : result?.token;
  if (!value) throw new Error('No access to Google Calendar.');
  return value;
}

async function fetchBusy(now: number, retry = true): Promise<Busy[]> {
  const access = await token(false);
  const response = await fetch(FREE_BUSY, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeMin: new Date(now).toISOString(),
      timeMax: new Date(now + AHEAD_MS).toISOString(),
      items: [{ id: 'primary' }],
    }),
  });
  if (response.status === 401 && retry) {
    // The cached token has expired: drop it and ask Chrome for a fresh one
    await browser.identity.removeCachedAuthToken({ token: access });
    return fetchBusy(now, false);
  }
  if (!response.ok) throw new Error(`Google Calendar answered ${response.status}.`);
  const data = (await response.json()) as { calendars?: { primary?: { busy?: { start: string; end: string }[] } } };
  return (data.calendars?.primary?.busy ?? []).map((b) => [Date.parse(b.start), Date.parse(b.end)]);
}

/** Asks for read-only access to busy times. Resolves with an error message to show, or nothing. */
export async function connectCalendar(now: number): Promise<string | undefined> {
  try {
    if (!(await testBusy())) {
      if (!configured()) return 'Google Calendar is not set up for this build yet.';
      await token(true);
    }
    await refreshCalendar(now);
  } catch (error) {
    return error instanceof Error ? error.message : 'Could not connect to Google Calendar.';
  }
}

export async function disconnectCalendar(): Promise<void> {
  await browser.storage.local.remove(BUSY_KEY);
  if (await testBusy()) return;
  try {
    const access = await token(false);
    await browser.identity.removeCachedAuthToken({ token: access });
    await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${access}`);
  } catch {
    // Already disconnected on Google's side
  }
}

/** Fetches the busy blocks of the coming hours and keeps them, so meetings are known between polls. */
export async function refreshCalendar(now: number): Promise<void> {
  const busy = (await testBusy()) ?? (await fetchBusy(now));
  await browser.storage.local.set({ [BUSY_KEY]: busy });
}

export async function savedBusy(): Promise<Busy[]> {
  return ((await browser.storage.local.get(BUSY_KEY))[BUSY_KEY] as Busy[] | undefined) ?? [];
}
