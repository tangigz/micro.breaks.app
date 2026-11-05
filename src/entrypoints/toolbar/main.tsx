import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, type ToolbarState, type ToolbarView } from '@/engine';
import { useStored } from '@/data/stored';
import { Wordmark } from '@/ui/Header';
import { Popup } from '@/ui/Popup';
import { mount } from '@/ui/mount';
import { tooltip } from '@/ui/toolbar-copy';
import { drawIcon, iconLook } from '@/ui/toolbar-icon';
import { FORCE_KEY, SAMPLE_STATES, sampleView } from '@/ui/toolbar-samples';
import '@/ui/tokens.css';

/**
 * Test mode only: every toolbar state side by side (icon at 2× and real size, tooltip, popup in
 * dark and light), and a switch that forces one of them on the real icon and popup.
 */

/** A weekday at 10:15, so the samples read like the design. */
const NOW = (() => {
  const d = new Date();
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(10, 15, 0, 0);
  return d.getTime();
})();
/** "Friday · 18:00" and "Saturday" read best on those days. */
const dayOf = (state: ToolbarState) => {
  const d = new Date(NOW);
  const want = state === 'done' ? 5 : state === 'weekend' ? 6 : null;
  if (want != null) d.setDate(d.getDate() + ((want - d.getDay() + 7) % 7));
  if (state === 'done') d.setHours(18, 0);
  return d.getTime();
};

function Icon({ view, size, scale }: { view: ToolbarView; size: number; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [bright, setBright] = useState(false);
  useEffect(() => {
    if (!view.pulse) return;
    const timer = setInterval(() => setBright((b) => !b), 800);
    return () => clearInterval(timer);
  }, [view.pulse]);
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    drawIcon(ctx, size * scale, { ...iconLook(view), bright: view.pulse && bright });
  }, [view, size, scale, bright]);
  return <canvas ref={ref} width={size * scale} height={size * scale} style={{ width: size, height: size }} />;
}

function Row({ state, label }: { state: ToolbarState; label: string }) {
  const now = dayOf(state);
  const view = sampleView(state, now);
  const settings = DEFAULT_SETTINGS;
  return (
    <section className="flex items-start gap-8 border-t border-line py-8" data-state={state}>
      <div className="flex w-[220px] shrink-0 flex-col gap-4">
        <div className="text-[15px] font-semibold">{label}</div>
        <div className="flex items-end gap-4">
          <div className="rounded-[16px] bg-raised p-3">
            <Icon view={view} size={64} scale={2} />
          </div>
          <Icon view={view} size={32} scale={1} />
          <Icon view={view} size={16} scale={2} />
        </div>
        <div className="text-[13px] leading-5 text-ink-2">{tooltip(view, settings)}</div>
      </div>
      <div className="overflow-hidden rounded-[16px] border border-line" data-theme="dark">
        <Popup view={view} settings={settings} now={now} act={() => {}} />
      </div>
      <div className="overflow-hidden rounded-[16px] border border-line" data-theme="light">
        <Popup view={view} settings={settings} now={now} act={() => {}} />
      </div>
    </section>
  );
}

function ForceSwitch() {
  const [forced, setForced] = useStored<ToolbarState | ''>(FORCE_KEY, '');
  if (forced == null) return null;
  return (
    <label className="flex items-center gap-3 text-[15px]">
      Force on the real icon and popup
      <select
        className="h-10 rounded-full bg-pill px-4 text-ink"
        value={forced}
        onChange={(e) => {
          const next = e.target.value as ToolbarState | '';
          setForced(next);
          if (!next) void browser.storage.local.remove(FORCE_KEY);
        }}
      >
        <option value="">Live state</option>
        {SAMPLE_STATES.map((s) => (
          <option key={s.state} value={s.state}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Page() {
  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-10 py-10">
      <header className="flex items-center justify-between">
        <Wordmark />
        <ForceSwitch />
      </header>
      <h1 className="m-0 text-[32px] font-bold tracking-[-0.03em]">Toolbar icon, tooltip and popup, every state</h1>
      {SAMPLE_STATES.map((s) => (
        <Row key={s.state} {...s} />
      ))}
    </main>
  );
}

mount(<Page />);
