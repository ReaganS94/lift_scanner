import { describe, expect, it } from 'vitest';
import { highestRun, lowestRun } from './extremes';

describe('lowestRun', () => {
  it('finds the smallest value', () => {
    expect(lowestRun([3, 1, 2])).toEqual({ value: 1, position: 1 });
  });

  it('points at the middle of a level run at the lowest', () => {
    expect(lowestRun([3, 1, 1, 1, 1, 1, 4])).toEqual({ value: 1, position: 3 });
  });

  it('keeps the first run when the lowest value comes back later', () => {
    expect(lowestRun([1, 1, 1, 5, 1])).toEqual({ value: 1, position: 1 });
  });

  it('ends a run at a missing value', () => {
    expect(lowestRun([1, 1, null, 1, 1])).toEqual({ value: 1, position: 1 });
  });

  it('is null when nothing was measured', () => {
    expect(lowestRun([null, null])).toBeNull();
    expect(lowestRun([])).toBeNull();
  });
});

describe('highestRun', () => {
  it('points at the middle of a level run at the highest', () => {
    expect(highestRun([0, 2, 2, 2, 1])).toEqual({ value: 2, position: 2 });
  });
});
