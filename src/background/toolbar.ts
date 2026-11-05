import { browser } from 'wxt/browser';
import { type State, type ToolbarState, type ToolbarView, toolbarView } from '@/engine';
import { BEAT_FRAMES, BEAT_MS, beat, drawIcon, type IconLook, iconLook } from '@/ui/toolbar-icon';
import { tooltip } from '@/ui/toolbar-copy';
import { FORCE_KEY, sampleView } from '@/ui/toolbar-samples';

/** The public site: "How it works". */
export const SITE = 'https://tangigz.github.io/micro.breaks.app/';

let pulseTimer: ReturnType<typeof setInterval> | undefined;
/** The beat's frames for the current look, drawn once and replayed. */
let pulseFrames: { key: string; frames: Record<string, ImageData>[] } | null = null;
let frame = 0;
/** The look last drawn, so a minute that changes nothing does not redraw. */
let drawn = '';

function render(look: IconLook): Record<string, ImageData> {
  const imageData: Record<string, ImageData> = {};
  for (const size of [16, 32]) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d')!;
    drawIcon(ctx, size, look);
    imageData[size] = ctx.getImageData(0, 0, size, size);
  }
  return imageData;
}

function paint(look: IconLook): void {
  void browser.action.setIcon({ imageData: render(look) }).catch(() => {});
}

function stopPulse(): void {
  if (pulseTimer != null) clearInterval(pulseTimer);
  pulseTimer = undefined;
  pulseFrames = null;
}

/**
 * The last minutes before a break: the glow swells and fades, eased, one beat every 1.6 s.
 * Each setIcon also keeps the service worker awake, so the timer runs as long as it is needed.
 * Never a badge.
 */
function startPulse(look: IconLook): void {
  const key = JSON.stringify({ ...look, level: Math.round(look.level) });
  if (pulseFrames?.key !== key) {
    pulseFrames = { key, frames: Array.from({ length: BEAT_FRAMES }, (_, i) => render({ ...look, pulse: beat(i) })) };
  }
  if (pulseTimer != null) return;
  pulseTimer = setInterval(() => {
    if (!pulseFrames) return;
    frame = (frame + 1) % BEAT_FRAMES;
    void browser.action.setIcon({ imageData: pulseFrames.frames[frame]! }).catch(() => {});
  }, BEAT_MS / BEAT_FRAMES);
}

/** Test mode: a state forced from the Test mode bar or the console. */
async function forced(): Promise<ToolbarState | null> {
  if (!import.meta.env.DEV) return null;
  return ((await browser.storage.local.get(FORCE_KEY))[FORCE_KEY] as ToolbarState | undefined) ?? null;
}

export async function viewFor(state: State, now: number): Promise<ToolbarView> {
  const force = await forced();
  return force ? sampleView(force, now) : toolbarView(state, now);
}

/** Draws the icon and sets the tooltip for the current state. Runs after every engine step. */
export async function updateToolbar(state: State, now: number): Promise<void> {
  const view = await viewFor(state, now);
  const look = iconLook(view);
  void browser.action.setTitle({ title: tooltip(view, state.settings) });

  if (view.pulse) {
    // The pulse timer draws the frames; a level change still reaches it
    startPulse(look);
    drawn = '';
    return;
  }
  stopPulse();
  // Levels in whole percents: no redraw for a change nobody could see
  const key = JSON.stringify({ ...look, level: Math.round(look.level) });
  if (key === drawn) return;
  drawn = key;
  paint(look);
}

export type MenuTarget = 'start' | 'settings' | 'how';

/** The three items on the icon's right-click menu. Chrome adds its own below them. */
export function createMenu(): void {
  const items: [MenuTarget, string][] = [
    ['start', 'Start a break now'],
    ['settings', 'Movement timer settings'],
    ['how', 'How it works'],
  ];
  browser.contextMenus.removeAll(() => {
    for (const [id, title] of items) browser.contextMenus.create({ id, title, contexts: ['action'] });
  });
}
