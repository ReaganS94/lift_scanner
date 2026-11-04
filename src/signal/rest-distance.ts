import type { Series } from './series';
import { percentile } from './stats';

/**
 * Where the rest position sits within a value's range: 'min' when the lifter rests at the
 * smallest value (e.g. hip y while standing, as y grows downwards), 'max' when at the largest.
 */
export type RestAt = 'min' | 'max';

/**
 * A robust estimate of the extreme: the 3rd or 97th percentile rather than the true minimum
 * or maximum, so a few bad detections can't set the rest position. It sits close to the
 * extreme because the lifter can spend most of a clip away from rest: standing before a
 * deadlift, or bracing before a heavy single.
 */
const REST_PERCENTILE = { min: 0.03, max: 0.97 } as const;

/**
 * Turns a raw position series into distance from the rest position, divided by `scale` (the
 * torso length). The result is near 0 at rest and grows as the lifter moves away from it, which
 * is the shape rep detection expects. All missing if nothing was measured.
 */
export function distanceFromRest(series: Series, restAt: RestAt, scale: number): (number | null)[] {
  const rest = percentile(series, REST_PERCENTILE[restAt]);
  if (rest === null || scale <= 0) return series.map(() => null);

  const direction = restAt === 'min' ? 1 : -1;
  return series.map((value) => (value === null ? null : (direction * (value - rest)) / scale));
}
