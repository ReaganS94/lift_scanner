import { describe, expect, it } from 'vitest';
import { median, percentile } from './stats';

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
