import type { ReactNode } from 'react';
import { send } from '@/data/client';
import type { Settings } from '@/engine';
import { applyTheme } from './theme';

export function Wordmark() {
  return (
    <div className="text-[20px] font-bold tracking-[-0.01em]">
      micro<span className="text-pos">.</span>breaks
    </div>
  );
}

function ThemeToggle({ theme }: { theme: Settings['theme'] }) {
  const next = theme === 'light' ? 'dark' : 'light';
  return (
    <button
      aria-label={`Switch to ${next} mode`}
      className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-pill"
      onClick={() => {
        applyTheme(next);
        void send({ type: 'settings', patch: { theme: next } });
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {theme === 'light' ? (
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </>
        )}
      </svg>
    </button>
  );
}

/** Wordmark left, theme toggle right. With `back`: Back left, wordmark centred. Children sit before the toggle. */
export function Header({ theme, back, children }: { theme: Settings['theme']; back?: string; children?: ReactNode }) {
  return (
    <header className="relative flex w-full items-center justify-between px-10 py-6">
      {back && (
        <a
          href={back}
          className="flex h-11 items-center gap-1.5 rounded-full bg-raised pr-4 pl-3 text-[15px] font-semibold text-ink no-underline"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back
        </a>
      )}
      <Wordmark />
      <div className={`flex items-center justify-end gap-4 ${back ? 'w-[88px]' : ''}`}>
        {children}
        <ThemeToggle theme={theme} />
      </div>
    </header>
  );
}
