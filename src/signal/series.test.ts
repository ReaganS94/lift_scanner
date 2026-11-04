import { describe, expect, it } from 'vitest';
import { fillGaps, smooth } from './series';

describe('fillGaps', () => {
  it('draws a straight line across a short gap', () => {
    expect(fillGaps([0, null, null, 3], 2)).toEqual([0, 1, 2, 3]);
  });

  it('leaves gaps longer than the limit alone', () => {
    expect(fillGaps([0, null, null, null, 4], 2)).toEqual([0, null, null, null, 4]);
  });

  it('leaves gaps at the start and end alone', () => {
    expect(fillGaps([null, 1, 2, null], 5)).toEqual([null, 1, 2, null]);
  });

  it('does not change the input', () => {
    const input = [0, null, 2];
    fillGaps(input, 1);
    expect(input).toEqual([0, null, 2]);
  });
});

describe('smooth', () => {
  it('averages each value with its neighbours', () => {
    expect(smooth([0, 3, 0, 3, 0], 1)).toEqual([1.5, 1, 2, 1, 1.5]);
  });

  it('keeps a symmetric peak on the same frame', () => {
    const smoothed = smooth([0, 1, 2, 3, 2, 1, 0], 1);
    const peak = smoothed.indexOf(Math.max(...smoothed.map((v) => v ?? -Infinity)));
    expect(peak).toBe(3);
  });

  it('keeps missing values missing and skips them in averages', () => {
    expect(smooth([2, null, 4], 1)).toEqual([2, null, 4]);
  });
});
