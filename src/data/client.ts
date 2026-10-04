import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import type { Input, State } from '@/engine';
import { clockNow } from './clock';
import { STATE_KEY } from './store';

export type Message = { mb: 'dispatch'; input: Input } | { mb: 'dev_advance'; ms: number };

/** Sends an action to the engine, through the background. Resolves with the new state. */
export function send(input: Input): Promise<State> {
  return browser.runtime.sendMessage({ mb: 'dispatch', input } satisfies Message);
}

/** Live engine state and the current time, refreshed every second. Null until loaded. */
export function useEngine(): { state: State; now: number } | null {
  const [state, setState] = useState<State | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // A tick makes the background create the state on first run
    void send({ type: 'tick' }).then(setState);
    const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && changes[STATE_KEY]?.newValue) setState(changes[STATE_KEY].newValue as State);
    };
    browser.storage.onChanged.addListener(onChanged);
    const refresh = () => void clockNow().then(setNow);
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => {
      browser.storage.onChanged.removeListener(onChanged);
      clearInterval(timer);
    };
  }, []);

  return state && now != null ? { state, now } : null;
}
