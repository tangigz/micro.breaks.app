type Rgb = [number, number, number];

const FULL: Rgb = [111, 207, 122];
const HALF: Rgb = [255, 197, 107];
const EMPTY: Rgb = [255, 138, 91];

const mix = (a: number, b: number, f: number) => Math.round(a + (b - a) * f);
const lerp = (a: Rgb, b: Rgb, f: number): Rgb => [mix(a[0], b[0], f), mix(a[1], b[1], f), mix(a[2], b[2], f)];

/** Battery colour for a level in 0–100: green → amber over the first half of the interval, then amber → coral. */
export function batteryRgb(level: number): Rgb {
  const t = 1 - Math.max(0, Math.min(100, level)) / 100;
  return t < 0.5 ? lerp(FULL, HALF, t / 0.5) : lerp(HALF, EMPTY, (t - 0.5) / 0.5);
}
