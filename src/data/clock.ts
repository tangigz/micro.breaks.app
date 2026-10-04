import { browser } from 'wxt/browser';

const KEY = 'devOffsetMs';

let offset: number | null = null;

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[KEY]) offset = (changes[KEY].newValue as number | undefined) ?? 0;
});

async function load(): Promise<number> {
  if (offset == null) offset = ((await browser.storage.local.get(KEY))[KEY] as number | undefined) ?? 0;
  return offset;
}

/** The time every part of the extension uses. Real time, plus the test-mode offset. */
export async function clockNow(): Promise<number> {
  return Date.now() + (await load());
}

/** Converts an engine timestamp back to real time, for chrome.alarms. */
export async function toRealTime(ts: number): Promise<number> {
  return ts - (await load());
}

export async function advanceClock(ms: number): Promise<void> {
  offset = (await load()) + ms;
  await browser.storage.local.set({ [KEY]: offset });
}
