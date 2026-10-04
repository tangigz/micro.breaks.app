import { browser } from 'wxt/browser';

export const HOME = '/newtab.html';
export const MISSION = '/mission.html';
export const SETUP = '/setup.html';

async function focusWindow(windowId: number | undefined): Promise<void> {
  if (windowId == null) return;
  // drawAttention covers the case where the OS keeps another app in front
  await browser.windows.update(windowId, { focused: true, drawAttention: true });
}

/** Brings one of our pages to the front: its existing tab if there is one, a new tab otherwise. */
export async function show(path: typeof HOME | typeof MISSION | typeof SETUP): Promise<void> {
  const url = browser.runtime.getURL(path);
  const [existing] = await browser.tabs.query({ url });
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
