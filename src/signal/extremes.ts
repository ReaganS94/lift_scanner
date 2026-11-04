import type { Series } from './series';

/** The most extreme value in a series, and where to show it. */
export interface Extreme {
  readonly value: number;
  /** Position in the series of the middle of the first run of values equal to the extreme. */
  readonly position: number;
}

/**
 * The smallest value, and the middle of the first unbroken run of positions that share it. A
 * rolling median is often level for a few frames at its lowest, and the middle of that run is
 * the moment to show. A missing value breaks a run. Null if nothing was measured.
 */
export function lowestRun(series: Series): Extreme | null {
  let best: { value: number; first: number; last: number } | null = null;
  let inBestRun = false;
  for (const [position, value] of series.entries()) {
    if (value === null) {
      inBestRun = false;
    } else if (best === null || value < best.value) {
      best = { value, first: position, last: position };
      inBestRun = true;
    } else if (inBestRun && value === best.value) {
      best.last = position;
    } else {
      inBestRun = false;
    }
  }
  return best && { value: best.value, position: Math.round((best.first + best.last) / 2) };
}

/** The largest value, and the middle of the first unbroken run that shares it. See lowestRun(). */
export function highestRun(series: Series): Extreme | null {
  const lowest = lowestRun(series.map((value) => (value === null ? null : -value)));
  return lowest && { value: -lowest.value, position: lowest.position };
}
