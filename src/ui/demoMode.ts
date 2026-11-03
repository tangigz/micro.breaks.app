import { useEffect, useState } from 'react';

/**
 * Demo mode, dev builds only: for filming. Hides the Test mode bar and lets "Switch mission"
 * be used as often as wanted. Ctrl+Shift+D toggles it on any micro.breaks page; the choice is
 * shared by every micro.breaks tab (same origin, so localStorage).
 */
const KEY = 'mb-demo-mode';

function read(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setDemoMode(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: stays as it is.
  }
  // The `storage` event only reaches other tabs: tell this one too.
  window.dispatchEvent(new Event('mb-demo-mode'));
}

export function useDemoMode(): boolean {
  const [on, setOn] = useState(read);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const update = () => setOn(read());
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setDemoMode(!read());
      }
    };
    window.addEventListener('storage', update);
    window.addEventListener('mb-demo-mode', update);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('mb-demo-mode', update);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
  return on;
}
