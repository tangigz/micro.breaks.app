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
const TRACK = '#48484A';
const GREY: Rgb = [142, 142, 147];
const GREEN: Rgb = [111, 207, 122];
/** Break due: an empty pill keeps a coral sliver. */
const SLIVER = 4;

export interface IconLook {
  rgb: Rgb;
  /** 0–100. */
  level: number;
  glow: boolean;
  /** The bright frame of the pulse: glow and charge about 45% brighter. */
  bright?: boolean;
}

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

  // Glow: the battery colour behind the pill
  if (look.glow) {
    const color = look.bright ? toward(look.rgb, 255, 0.25) : look.rgb;
    const alpha = look.bright ? 1 : 0.75;
    const g = ctx.createRadialGradient(32, 35.2, 0, 32, 35.2, 32);
    g.addColorStop(0, css(color, alpha));
    g.addColorStop(1, css(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  ctx.restore();

  // Track
  pill(ctx, 21, 11, 22, 42, 11);
  ctx.fillStyle = TRACK;
  ctx.fill();

  // Charge, from the bottom; an empty battery keeps a sliver
  const height = Math.max(SLIVER, (42 * Math.max(0, Math.min(100, look.level))) / 100);
  const base = look.bright ? toward(look.rgb, 255, 0.45) : look.rgb;
  ctx.save();
  pill(ctx, 21, 11, 22, 42, 11);
  ctx.clip();
  const fill = ctx.createLinearGradient(0, 53 - height, 0, 53);
  fill.addColorStop(0, css(toward(base, 255, 0.55)));
  fill.addColorStop(1, css(base));
  ctx.fillStyle = fill;
  ctx.fillRect(21, 53 - height, 22, height);
  ctx.restore();

  ctx.restore();
}
