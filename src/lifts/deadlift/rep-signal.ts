import type { ClipContext } from '../../core';
import { averagePoint, SHOULDERS } from '../../geometry';
import { distanceFromRest } from '../../signal';

/**
 * How far the shoulders have risen above their position with the bar on the floor, in torso
 * lengths. A deadlift rests at the bottom between reps, which is why the rest position here is
 * the lowest point rather than standing.
 *
 * The shoulders rather than the hands: filmed from the side, the near plate covers the hands
 * (and the knees) for the whole pull, so the model barely sees them. The shoulders stay in view
 * above the plates and rise about a torso length from the floor to lockout.
 */
export function deadliftRepSignal(clip: ClipContext): (number | null)[] {
  const shoulderY = clip.sequence.frames.map((frame) => averagePoint(frame, SHOULDERS)?.y ?? null);
  // y grows downwards, so the bar on the floor is the largest shoulder y.
  return distanceFromRest(shoulderY, 'max', clip.torsoLength);
}
