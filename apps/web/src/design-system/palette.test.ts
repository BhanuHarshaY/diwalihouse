import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PALETTE } from './palette';

const css = readFileSync(new URL('../styles/globals.css', import.meta.url), 'utf8');
const themeColors = Object.fromEntries(
  [...css.matchAll(/--color-([a-z]+)-(\d+):\s*(#[0-9a-f]{6});/g)].map(([, name, step, hex]) => [
    `${name}${step}`,
    hex,
  ]),
);

describe('palette', () => {
  it('matches the CSS @theme tokens exactly', () => {
    expect(PALETTE).toEqual(themeColors);
  });
});
