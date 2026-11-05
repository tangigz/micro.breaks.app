import type { ToolbarView } from '@/engine';
import { batteryRgb } from './battery-color';

type Rgb = [number, number, number];
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * The toolbar icon, drawn live: the Glow icon, its pill acting as the battery. Artwork on a
 * 64-unit grid, scaled to the canvas. Hex colours live here, not in tokens: this is a picture
 * drawn in the service worker, which has no CSS.
 */
const TILE = '#0B0B0C';
const TRACK: Rgb = [72, 72, 74];
const GREY: Rgb = [142, 142, 147];
const GREEN: Rgb = [111, 207, 122];
/** Break due: an empty pill keeps a coral sliver. */
const SLIVER = 5;
/**
 * The pill, larger than the Glow icon's 22 × 42 so the battery reads at 16 px: Chrome caps
 * toolbar icons at 16 px, so the only way to make it bigger is to fill more of the tile.
 */
const PILL = { x: 17, y: 5, w: 30, h: 54, r: 15 };
const BOTTOM = PILL.y + PILL.h;

export interface IconLook {
  rgb: Rgb;
  /** 0–100. */
  level: number;
  glow: boolean;
  /** The pulse, 0 (rest) to 1 (peak): the glow swells and the charge brightens. */
  pulse?: number;
}

/** One beat of the pulse, in ms. */
export const BEAT_MS = 1600;
/** Frames per beat: enough for a smooth swell, few enough for the service worker. */
export const BEAT_FRAMES = 20;
/** Pulse intensity at a point of the beat, eased in and out: 0 at rest, 1 at the peak. */
export const beat = (frame: number) => (1 - Math.cos((2 * Math.PI * frame) / BEAT_FRAMES)) / 2;

export function iconLook(view: ToolbarView): IconLook {
  if (view.tone === 'grey') return { rgb: GREY, level: 100, glow: false };
  if (view.tone === 'green') return { rgb: GREEN, level: view.level, glow: true };
  return { rgb: batteryRgb(view.level), level: view.level, glow: true };
}

const toward = (c: Rgb, to: number, f: number): Rgb => c.map((v) => Math.round(v + (to - v) * f)) as Rgb;
const css = ([r, g, b]: Rgb, a = 1) => `rgba(${r}, ${g}, ${b}, ${a})`;

function pill(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawIcon(ctx: Ctx, size: number, look: IconLook): void {
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.scale(size / 64, size / 64);

  // Tile
  pill(ctx, 0, 0, 64, 64, 15);
  ctx.fillStyle = TILE;
  ctx.fill();
  ctx.save();
  ctx.clip();

  // Glow: the battery colour behind the pill. While pulsing it breathes from dim to full and brighter.
  const p = look.pulse;
  if (look.glow) {
    const color = p != null ? toward(look.rgb, 255, 0.35 * p) : look.rgb;
    const alpha = p != null ? 0.2 + 0.8 * p : 0.75;
    const radius = p != null ? 26 + 14 * p : 32;
    const g = ctx.createRadialGradient(32, 35.2, 0, 32, 35.2, radius);
    g.addColorStop(0, css(color, alpha));
    g.addColorStop(1, css(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  ctx.restore();

  // Track. At the peak of the pulse it takes on the battery colour, so the whole pill lights up:
  // at 16 px the glow alone is too small to notice.
  pill(ctx, PILL.x, PILL.y, PILL.w, PILL.h, PILL.r);
  ctx.fillStyle = css(p != null ? TRACK.map((v, i) => Math.round(v + (look.rgb[i]! - v) * 0.45 * p)) as Rgb : TRACK);
  ctx.fill();

  // Charge, from the bottom; an empty battery keeps a sliver
  const height = Math.max(SLIVER, (PILL.h * Math.max(0, Math.min(100, look.level))) / 100);
  const base = p != null ? toward(look.rgb, 255, 0.45 * p) : look.rgb;
  ctx.save();
  pill(ctx, PILL.x, PILL.y, PILL.w, PILL.h, PILL.r);
  ctx.clip();
  const fill = ctx.createLinearGradient(0, BOTTOM - height, 0, BOTTOM);
  fill.addColorStop(0, css(toward(base, 255, 0.55)));
  fill.addColorStop(1, css(base));
  ctx.fillStyle = fill;
  ctx.fillRect(PILL.x, BOTTOM - height, PILL.w, height);
  ctx.restore();

  ctx.restore();
}
