import { describe, expect, it } from 'vitest';
import { type Busy, busyUntil } from './calendar';

const at = (h: number, m = 0) => new Date(2026, 9, 5, h, m).getTime();

describe('busyUntil', () => {
  const busy: Busy[] = [
    [at(10), at(10, 30)],
    [at(14), at(15)],
    [at(15), at(15, 30)],
    [at(15, 15), at(16)],
  ];

  it('is null outside meetings', () => {
    expect(busyUntil(busy, at(9, 59))).toBeNull();
    expect(busyUntil(busy, at(10, 30))).toBeNull();
    expect(busyUntil([], at(10))).toBeNull();
  });

  it('gives the end of the meeting that is running', () => {
    expect(busyUntil(busy, at(10))).toBe(at(10, 30));
    expect(busyUntil(busy, at(10, 29))).toBe(at(10, 30));
  });

  it('treats back-to-back and overlapping meetings as one', () => {
    expect(busyUntil(busy, at(14, 10))).toBe(at(16));
    expect(busyUntil(busy, at(15, 40))).toBe(at(16));
  });

  it('does not depend on the order of the blocks', () => {
    expect(busyUntil([...busy].reverse(), at(14, 10))).toBe(at(16));
  });
});
