import { describe, expect, it } from 'vitest';
import { batteryRgb } from './battery-color';

describe('batteryRgb', () => {
  it('is green when full, amber at half, coral when empty', () => {
    expect(batteryRgb(100)).toEqual([111, 207, 122]);
    expect(batteryRgb(50)).toEqual([255, 197, 107]);
    expect(batteryRgb(0)).toEqual([255, 138, 91]);
  });

  it('clamps levels outside 0–100', () => {
    expect(batteryRgb(140)).toEqual(batteryRgb(100));
    expect(batteryRgb(-5)).toEqual(batteryRgb(0));
  });
});
