import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

/** A value kept in chrome.storage.local, for screen state that must survive a closed tab. Null until loaded. */
export function useStored<T>(key: string, initial: T): [T | null, (next: T) => void] {
  const [value, setValue] = useState<T | null>(null);

  useEffect(() => {
    void browser.storage.local.get(key).then((saved) => setValue((saved[key] as T | undefined) ?? initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = (next: T) => {
    setValue(next);
    void browser.storage.local.set({ [key]: next });
  };
  return [value, set];
}
