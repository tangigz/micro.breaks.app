/** Seeded randomness (mulberry32), so the engine stays pure. Advances `holder.seed`. */
export function rand(holder: { seed: number }): number {
  holder.seed = (holder.seed + 0x6d2b79f5) | 0;
  let t = holder.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(holder: { seed: number }, min: number, max: number): number {
  return min + Math.floor(rand(holder) * (max - min + 1));
}

export function shuffle<T>(holder: { seed: number }, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(holder, 0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
