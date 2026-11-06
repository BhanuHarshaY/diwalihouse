import { describe, expect, it } from 'vitest';
import { lampOffsets, placeLamp, stageLayout, zoomToShow } from './camera';

const desktop = stageLayout({ width: 1440, height: 900 });
const phone = stageLayout({ width: 390, height: 844 });

describe('stage layout', () => {
  it('uses nine lamps on wide screens and seven on phones', () => {
    expect(desktop.count).toBe(9);
    expect(phone.count).toBe(7);
  });

  it('opens on a genuine close-up', () => {
    expect(desktop.zMax).toBeGreaterThan(3);
    expect(phone.zMax).toBeGreaterThan(3);
  });

  it('orders lamps centre-out', () => {
    expect(lampOffsets(7)).toEqual([0, -1, 1, -2, 2, -3, 3]);
  });
});

describe('placeLamp', () => {
  for (const [name, layout] of [
    ['desktop', desktop],
    ['phone', phone],
  ] as const) {
    it(`${name}: at z = 1 the whole row fits inside the viewport`, () => {
      const half = (layout.count - 1) / 2;
      for (let k = -half; k <= half; k++) {
        const p = placeLamp(layout, k, 1);
        const rendered = layout.baseWidth * p.scale;
        expect(p.centerX - rendered / 2).toBeGreaterThan(0);
        expect(p.centerX + rendered / 2).toBeLessThan(layout.viewport.width);
      }
    });

    it(`${name}: lamps are only ever scaled down`, () => {
      for (let z = 1; z <= layout.zMax; z += 0.25) {
        expect(placeLamp(layout, 0, z).scale).toBeLessThanOrEqual(1);
      }
      expect(placeLamp(layout, 0, layout.zMax).scale).toBeCloseTo(1, 10);
    });
  }
});

describe('zoomToShow', () => {
  it('stays on the close-up until a neighbour is lit', () => {
    expect(zoomToShow(desktop, 0)).toBe(desktop.zMax);
  });

  it('pulls back monotonically as the light spreads', () => {
    let previous = Infinity;
    for (let r = 0; r <= 4; r++) {
      const z = zoomToShow(desktop, r);
      expect(z).toBeLessThanOrEqual(previous);
      previous = z;
    }
  });

  it('keeps every lit lamp on screen', () => {
    for (const layout of [desktop, phone]) {
      const half = (layout.count - 1) / 2;
      for (let r = 1; r <= half; r++) {
        const z = zoomToShow(layout, r);
        const outer = placeLamp(layout, r, z);
        expect(outer.centerX + (layout.baseWidth * outer.scale) / 2).toBeLessThanOrEqual(
          layout.viewport.width,
        );
      }
    }
  });
});
