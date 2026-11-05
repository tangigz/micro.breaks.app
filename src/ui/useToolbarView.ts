import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { type State, type ToolbarState, type ToolbarView, toolbarView } from '@/engine';
import { FORCE_KEY, sampleView } from './toolbar-samples';

/** The toolbar view of the live state, or, in test mode, the state forced from the Test mode bar. */
export function useToolbarView(state: State, now: number): ToolbarView {
  const [forced, setForced] = useState<ToolbarState | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    void browser.storage.local.get(FORCE_KEY).then((got) => setForced((got[FORCE_KEY] as ToolbarState | undefined) ?? null));
    const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && FORCE_KEY in changes) setForced((changes[FORCE_KEY]!.newValue as ToolbarState | undefined) ?? null);
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, []);
  return forced ? sampleView(forced, now) : toolbarView(state, now);
}
