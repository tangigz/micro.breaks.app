import type { Settings } from '@/engine';

type Theme = Settings['theme'];

const KEY = 'theme';

/** Dark is the default. The choice is mirrored in localStorage so a page paints in the right theme at once. */
export function applyTheme(theme: Theme): void {
  if (theme === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  localStorage.setItem(KEY, theme);
}

export function applySavedTheme(): void {
  applyTheme(localStorage.getItem(KEY) === 'light' ? 'light' : 'dark');
}
