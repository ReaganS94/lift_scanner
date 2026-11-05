import { describe, expect, it } from 'vitest';
import { readScene } from '../testing/plate-scene';
import { findCircle } from './find-circle';

/** A 100×80 pixel picture: one unit is 100 pixels, so positions below are in pixels / 100. */
const REGION = { x: 0, y: 0, width: 1, height: 0.8 };
const PPU = 100;

describe('findCircle', () => {
  it('finds a dark plate on a light background to a fraction of a pixel', () => {
    const image = readScene({ x: 0.523, y: 0.387, radius: 0.24 }, REGION, PPU);
    const circle = findCircle(image, { minRadius: 15, maxRadius: 35 });
    expect(circle?.x).toBeCloseTo(52.3 - 0.5, 0);
    expect(circle?.y).toBeCloseTo(38.7 - 0.5, 0);
    expect(circle?.radius).toBeGreaterThanOrEqual(23);
    expect(circle?.radius).toBeLessThanOrEqual(25);
    expect(circle?.score).toBeGreaterThan(0.9);
  });

  it('finds a light plate on a dark background', () => {
    const image = readScene({ x: 0.5, y: 0.4, radius: 0.2 }, REGION, PPU, {
      plate: 220,
      background: 40,
    });
    const circle = findCircle(image, { minRadius: 15, maxRadius: 30 });
    expect(Math.abs((circle?.x ?? 0) - 49.5)).toBeLessThan(1);
    expect(Math.abs((circle?.y ?? 0) - 39.5)).toBeLessThan(1);
  });

  it('still finds a plate cut off by the edge of the picture, with a lower score', () => {
    const image = readScene({ x: 0.9, y: 0.4, radius: 0.24 }, REGION, PPU);
    const circle = findCircle(image, { minRadius: 15, maxRadius: 35 });
    expect(Math.abs((circle?.x ?? 0) - 89.5)).toBeLessThan(1.5);
    expect(circle?.score).toBeGreaterThan(0.4);
    expect(circle?.score).toBeLessThan(0.9);
  });

  it('copes with sensor noise', () => {
    const image = readScene({ x: 0.45, y: 0.42, radius: 0.24 }, REGION, PPU, {
      noise: 12,
      seed: 7,
    });
    const circle = findCircle(image, { minRadius: 15, maxRadius: 35 });
    expect(Math.abs((circle?.x ?? 0) - 44.5)).toBeLessThan(1);
    expect(Math.abs((circle?.y ?? 0) - 41.5)).toBeLessThan(1);
    expect(circle?.score).toBeGreaterThan(0.8);
  });

  it('prefers the plate to a smaller round thing outside the size range', () => {
    const image = readScene({ x: 0.6, y: 0.4, radius: 0.24 }, REGION, PPU, {
      distractors: [{ x: 0.15, y: 0.2, radius: 0.08, shade: 0 }],
    });
    const circle = findCircle(image, { minRadius: 15, maxRadius: 35 });
    expect(Math.abs((circle?.x ?? 0) - 59.5)).toBeLessThan(1);
  });

  it('gives a low score when there is no circle, only a straight edge', () => {
    const image = readScene({ x: 10, y: 0.4, radius: 9.6 }, REGION, PPU);
    const circle = findCircle(image, { minRadius: 15, maxRadius: 35 });
    expect(circle?.score ?? 0).toBeLessThan(0.35);
  });

  it('returns null for a blank picture', () => {
    const image = readScene(null, REGION, PPU);
    expect(findCircle(image, { minRadius: 15, maxRadius: 35 })).toBeNull();
  });
});
