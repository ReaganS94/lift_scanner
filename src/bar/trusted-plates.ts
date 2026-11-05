import { TRUSTED_PLATE_CONFIDENCE, type BarPoint } from '../core';
import { median } from '../signal';
import { MAX_MISSES } from './plate-tracker';

/**
 * The plate track with the locks that can't be trusted left out. A lock is one stretch the
 * tracker followed without losing the plate for more than MAX_MISSES frames; after that it looks
 * afresh and may find something else. A lock is kept when the median
 * confidence over it is at least TRUSTED_PLATE_CONFIDENCE.
 *
 * Judged per lock, not per frame: on a clean side-on clip the score dips to about 0.6 at
 * lockout, where the body crosses the plate's edge, and a wrong lock has its odd good frame.
 */
export function trustedPlates(track: readonly (BarPoint | null)[]): (BarPoint | null)[] {
  const trusted: (BarPoint | null)[] = track.map(() => null);
  let lock: number[] = [];
  let gap = 0;
  const settle = () => {
    const confidence = median(lock.map((index) => track[index]?.confidence ?? null));
    if (confidence !== null && confidence >= TRUSTED_PLATE_CONFIDENCE) {
      for (const index of lock) trusted[index] = track[index] ?? null;
    }
    lock = [];
  };
  track.forEach((point, index) => {
    if (!point) {
      gap++;
      return;
    }
    if (gap > MAX_MISSES) settle();
    lock.push(index);
    gap = 0;
  });
  settle();
  return trusted;
}
