import { browser } from 'wxt/browser';

export const HOME = '/newtab.html';
export const MISSION = '/mission.html';
export const SETUP = '/setup.html';

async function focusWindow(windowId: number | undefined): Promise<void> {
  if (windowId == null) return;
  // drawAttention covers the case where the OS keeps another app in front
  await browser.windows.update(windowId, { focused: true, drawAttention: true });
}

type Path = typeof HOME | typeof MISSION | typeof SETUP;

async function open(path: Path): Promise<void> {
  const url = browser.runtime.getURL(path);
  // A tab that is still loading only has a pendingUrl, which tabs.query({ url }) does not match
  const ours = (await browser.tabs.query({})).filter((t) => (t.pendingUrl ?? t.url) === url);
  const [existing, ...extra] = ours;
  // Never two of the same page: two mission tabs would play the video twice
  for (const tab of extra) if (tab.id != null) await browser.tabs.remove(tab.id);
  if (existing?.id != null) {
    await browser.tabs.update(existing.id, { active: true });
    return focusWindow(existing.windowId);
  }
  if (path === HOME) {
    // A plain new tab already is micro.breaks
    const [active] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if ((active?.pendingUrl ?? active?.url ?? '').startsWith('chrome://newtab')) return focusWindow(active!.windowId);
  }
  const windows = await browser.windows.getAll({ windowTypes: ['normal'] });
  if (windows.length === 0) {
    await browser.windows.create({ url, focused: true });
    return;
  }
  const tab = await browser.tabs.create({ url, active: true });
  return focusWindow(tab.windowId);
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Brings one of our pages to the front: its existing tab if there is one, a new tab otherwise.
 * One call at a time: the prompt and the lock both ask for the mission tab at the same moment.
 */
export function show(path: Path): Promise<void> {
  const result = queue.then(() => open(path));
  queue = result.catch(() => {});
  return result;
}
