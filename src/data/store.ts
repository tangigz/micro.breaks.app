import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, initialState, type State } from '@/engine';

export const STATE_KEY = 'state';

/** Saved state, brought up to date with the current shape so new fields are never undefined. */
export async function loadState(now: number): Promise<State> {
  const fresh = initialState(now, crypto.getRandomValues(new Uint32Array(1))[0]!);
  const saved = (await browser.storage.local.get(STATE_KEY))[STATE_KEY] as Partial<State> | undefined;
  if (!saved) return fresh;
  return { ...fresh, ...saved, settings: { ...DEFAULT_SETTINGS, ...saved.settings } };
}

export async function saveState(state: State): Promise<void> {
  await browser.storage.local.set({ [STATE_KEY]: state });
}
