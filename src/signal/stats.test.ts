import { describe, expect, it } from 'vitest';
import { median, percentile, rollingMedian } from './stats';

describe('percentile', () => {
  it('interpolates between ranks', () => {
    expect(percentile([0, 10], 0.25)).toBeCloseTo(2.5);
  });

  it('ignores missing values and order', () => {
    expect(percentile([3, null, 1, 2], 0)).toBe(1);
    expect(percentile([3, null, 1, 2], 1)).toBe(3);
  });

  it('is null when nothing was measured', () => {
    expect(percentile([null, null], 0.5)).toBeNull();
  });
});

describe('median', () => {
  it('is the middle value', () => {
    expect(median([5, 1, 3])).toBe(3);
  });
});

describe('rollingMedian', () => {
  it('ignores a one-frame spike that an average would spread around', () => {
    expect(rollingMedian([1, 1, 1, 0, 1, 1, 1], 2)).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });

  it('follows a change that lasts at least half the window', () => {
    expect(rollingMedian([1, 1, 0, 0, 0, 1, 1], 1)).toEqual([1, 1, 0, 0, 0, 1, 1]);
  });

  it('skips missing values in the window and keeps missing frames missing', () => {
    expect(rollingMedian([1, null, 3, 5], 1)).toEqual([1, null, 4, 4]);
  });
});
