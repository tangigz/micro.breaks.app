import type { ToolbarView } from '@/engine';
import { batteryRgb } from './battery-color';

type Rgb = [number, number, number];
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * The toolbar icon, drawn live: a slim battery on the dark tile, the same language as the
 * popup's battery (a thin outline, the charge inset inside it). Artwork on a 64-unit grid,
 * scaled to the canvas. Hex colours live here, not in tokens: this is a picture drawn in the
 * service worker, which has no CSS.
 */
const TILE = '#0B0B0C';
/** The battery's outline: light, so the shape reads at 16 px even when the charge is low. */
const OUTLINE = 'rgba(245, 245, 247, 0.9)';
const GREY: Rgb = [142, 142, 147];
const GREEN: Rgb = [111, 207, 122];

/** Body and cap of the battery. */
const BODY = { x: 21, y: 13, w: 22, h: 42, r: 7 };
const CAP = { x: 27, y: 8, w: 10, h: 3.5, r: 1.5 };
const STROKE = 3;
/** The charge sits inside the outline, with a gap. */
const INSET = STROKE / 2 + 2.5;
const CHARGE = { x: BODY.x + INSET, y: BODY.y + INSET, w: BODY.w - 2 * INSET, h: BODY.h - 2 * INSET, r: 3.5 };
/** An empty battery keeps a sliver of charge. */
const SLIVER = 3;

export interface IconLook {
  rgb: Rgb;
  /** 0–100. */
  level: number;
  glow: boolean;
  /** The pulse, 0 (rest) to 1 (peak): the glow breathes. */
  pulse?: number;
}

/** One breath of the pulse, in ms. */
export const BEAT_MS = 2000;
/** Frames per breath: enough for a smooth swell, few enough for the service worker. */
export const BEAT_FRAMES = 30;
/** Pulse intensity at a point of the breath, eased in and out: 0 at rest, 1 at the peak. */
export const beat = (frame: number) => (1 - Math.cos((2 * Math.PI * frame) / BEAT_FRAMES)) / 2;

export function iconLook(view: ToolbarView): IconLook {
  if (view.tone === 'grey') return { rgb: GREY, level: 100, glow: false };
  if (view.tone === 'green') return { rgb: GREEN, level: view.level, glow: true };
  return { rgb: batteryRgb(view.level), level: view.level, glow: true };
}

const toward = (c: Rgb, to: number, f: number): Rgb => c.map((v) => Math.round(v + (to - v) * f)) as Rgb;
const css = ([r, g, b]: Rgb, a = 1) => `rgba(${r}, ${g}, ${b}, ${a})`;

function rounded(ctx: Ctx, { x, y, w, h, r }: { x: number; y: number; w: number; h: number; r: number }) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawIcon(ctx: Ctx, size: number, look: IconLook): void {
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.scale(size / 64, size / 64);

  // Tile
  rounded(ctx, { x: 0, y: 0, w: 64, h: 64, r: 15 });
  ctx.fillStyle = TILE;
  ctx.fill();
  ctx.save();
  ctx.clip();

  // Glow: a soft light in the battery colour. While pulsing it breathes, gently.
  const p = look.pulse;
  if (look.glow) {
    const alpha = p != null ? 0.32 + 0.38 * p : 0.5;
    const g = ctx.createRadialGradient(32, 36, 0, 32, 36, 30);
    g.addColorStop(0, css(look.rgb, alpha));
    g.addColorStop(1, css(look.rgb, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  ctx.restore();

  // Outline and cap
  rounded(ctx, BODY);
  ctx.lineWidth = STROKE;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  rounded(ctx, CAP);
  ctx.fillStyle = OUTLINE;
  ctx.fill();

  // Charge, from the bottom: lighter at the top, like the new tab battery's shine
  const level = Math.max(0, Math.min(100, look.level));
  const height = Math.max(SLIVER, (CHARGE.h * level) / 100);
  const bottom = CHARGE.y + CHARGE.h;
  const base = p != null ? toward(look.rgb, 255, 0.15 * p) : look.rgb;
  ctx.save();
  rounded(ctx, CHARGE);
  ctx.clip();
  const fill = ctx.createLinearGradient(0, bottom - height, 0, bottom);
  fill.addColorStop(0, css(toward(base, 255, 0.3)));
  fill.addColorStop(1, css(base));
  ctx.fillStyle = fill;
  ctx.fillRect(CHARGE.x, bottom - height, CHARGE.w, height);
  ctx.restore();

  ctx.restore();
}
