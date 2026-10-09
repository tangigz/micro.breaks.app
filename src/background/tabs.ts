import { browser } from 'wxt/browser';

export const HOME = '/newtab.html';
export const MISSION = '/mission.html';
export const SETUP = '/setup.html';

type Path = typeof HOME | typeof MISSION | typeof SETUP;

/**
 * micro.breaks only ever needs to know about its own tabs, so it does not ask for the "tabs"
 * permission (and Chrome does not warn about reading browsing history). Its pages are found
 * through runtime.getContexts, which lists the extension's own open pages and nothing else.
 */
async function ownTabs(path: Path): Promise<number[]> {
  const url = browser.runtime.getURL(path);
  const contexts = await browser.runtime.getContexts({ contextTypes: ['TAB'] });
  const ids = contexts.filter((c) => c.documentUrl?.split(/[?#]/)[0] === url && c.tabId >= 0).map((c) => c.tabId);
  // A tab we just created is not listed until its page has loaded. Once it is listed, the list
  // is the truth: the same tab may since have moved on to another of our pages.
  const pending = opening.get(path);
  if (pending != null) {
    const loaded = contexts.some((c) => c.tabId === pending);
    if (loaded || !(await browser.tabs.get(pending).catch(() => null))) opening.delete(path);
    else ids.unshift(pending);
  }
  return ids;
}

/** Tabs created a moment ago, by page. */
const opening = new Map<Path, number>();

async function focusWindow(windowId: number | undefined): Promise<void> {
  if (windowId == null) return;
  // drawAttention covers the case where the OS keeps another app in front
  await browser.windows.update(windowId, { focused: true, drawAttention: true });
}

/** True when the tab in front is this page of ours. */
export async function inFront(path: Path): Promise<boolean> {
  const [active] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  return active?.id != null && (await ownTabs(path)).includes(active.id);
}

async function open(path: Path): Promise<void> {
  const [existing, ...extra] = await ownTabs(path);
  // Never two of the same page: two mission tabs would play the video twice
  if (path !== HOME) for (const id of extra) await browser.tabs.remove(id).catch(() => {});
  // A new tab that is already in front is micro.breaks: nothing to open
  if (path === HOME && (await inFront(HOME))) return;
  if (existing != null) {
    const tab = await browser.tabs.update(existing, { active: true });
    return focusWindow(tab?.windowId);
  }
  const url = browser.runtime.getURL(path);
  const windows = await browser.windows.getAll({ windowTypes: ['normal'] });
  if (windows.length === 0) {
    const created = await browser.windows.create({ url, focused: true });
    const id = created?.tabs?.[0]?.id;
    if (id != null) opening.set(path, id);
    return;
  }
  const tab = await browser.tabs.create({ url, active: true });
  if (tab.id != null) opening.set(path, tab.id);
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
