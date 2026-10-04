import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const container = document.getElementById('root') as HTMLElement & { root?: Root };

/**
 * Renders a page. In dev, hot reload runs the entry file again: reuse the same root, or a second
 * copy of the page is added under the first one (and a video mission plays twice).
 */
export function mount(page: ReactNode): void {
  container.root ??= createRoot(container);
  container.root.render(page);
}
