/**
 * Repeatable noise for tests, so a test that adds landmark jitter gives the same result on
 * every run.
 */
import { LANDMARK, type Landmark, type LandmarkName } from '../core';

/** A seeded pseudo-random number generator (mulberry32) returning values in [0, 1). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normally distributed noise with mean 0 and the given standard deviation (Box-Muller). */
export function gaussian(random: () => number, standardDeviation: number): number {
  const u = 1 - random(); // in (0, 1], so the log is finite
  const v = random();
  return standardDeviation * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** A copy of the landmarks with independent noise added to the x and y of the named points. */
export function jittered(
  landmarks: readonly Landmark[],
  names: readonly LandmarkName[],
  standardDeviation: number,
  random: () => number,
): Landmark[] {
  const result = [...landmarks];
  for (const name of names) {
    const point = result[LANDMARK[name]];
    if (!point) continue;
    result[LANDMARK[name]] = {
      ...point,
      x: point.x + gaussian(random, standardDeviation),
      y: point.y + gaussian(random, standardDeviation),
    };
  }
  return result;
}
