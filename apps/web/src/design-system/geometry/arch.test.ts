import { describe, expect, it } from 'vitest';
import { cuspedArch } from './arch';

const spec = { cx: 200, baseY: 600, springY: 300, apexY: 60, halfWidth: 150, lobes: 5 };

describe('cuspedArch', () => {
  it('starts and ends on the threshold at the jambs', () => {
    const { d } = cuspedArch(spec);
    expect(d.startsWith('M50 600L50 300')).toBe(true);
    expect(d.endsWith('L350 600')).toBe(true);
  });

  it('draws one foil per segment on each side', () => {
    const { d } = cuspedArch(spec);
    expect(d.match(/A/g)).toHaveLength(spec.lobes * 2);
  });

  it('is mirror-symmetric about the centre and peaks at the apex', () => {
    const { cusps } = cuspedArch(spec);
    expect(cusps).toHaveLength(spec.lobes * 2 - 1);
    const apex = cusps[spec.lobes - 1]!;
    expect(apex).toEqual([200, 60]);
    for (let i = 0; i < cusps.length; i++) {
      const [x, y] = cusps[i]!;
      const [mx, my] = cusps[cusps.length - 1 - i]!;
      expect(x + mx).toBeCloseTo(400, 5);
      expect(y).toBeCloseTo(my, 5);
    }
  });

  it('keeps every cusp between the spring line and the apex', () => {
    for (const [x, y] of cuspedArch(spec).cusps) {
      expect(y).toBeGreaterThanOrEqual(60);
      expect(y).toBeLessThan(300);
      expect(x).toBeGreaterThan(50);
      expect(x).toBeLessThan(350);
    }
  });
});
