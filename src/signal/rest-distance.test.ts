import { describe, expect, it } from 'vitest';
import { distanceFromRest } from './rest-distance';

describe('distanceFromRest', () => {
  const resting = Array.from({ length: 20 }, () => 0.5);

  it('measures upwards from a rest at the minimum', () => {
    const signal = distanceFromRest([...resting, 0.7, 0.9, 0.7, ...resting], 'min', 0.2);
    expect(signal[0]).toBeCloseTo(0);
    expect(signal[21]).toBeCloseTo(2);
  });

  it('measures downwards from a rest at the maximum', () => {
    const signal = distanceFromRest([...resting, 0.3, 0.1, 0.3, ...resting], 'max', 0.2);
    expect(signal[0]).toBeCloseTo(0);
    expect(signal[21]).toBeCloseTo(2);
  });

  it('keeps missing values missing', () => {
    expect(distanceFromRest([...resting, null], 'min', 1).at(-1)).toBeNull();
  });

  it('is all missing when nothing was measured', () => {
    expect(distanceFromRest([null, null], 'min', 1)).toEqual([null, null]);
  });
});
