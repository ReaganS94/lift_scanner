import { describe, expect, it } from 'vitest';
import { looksBlack } from './looks-black';

const pixels = (...values: number[][]) => new Uint8ClampedArray(values.flat());

describe('looksBlack', () => {
  it('is true for black and near-black pixels', () => {
    expect(looksBlack(pixels([0, 0, 0, 255], [5, 8, 3, 255]))).toBe(true);
  });

  it('is false as soon as one pixel has some brightness in any channel', () => {
    expect(looksBlack(pixels([0, 0, 0, 255], [0, 0, 40, 255]))).toBe(false);
  });

  it('ignores alpha', () => {
    expect(looksBlack(pixels([0, 0, 0, 0], [2, 2, 2, 0]))).toBe(true);
  });
});
