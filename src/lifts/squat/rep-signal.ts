import type { ClipContext } from '../../core';
import { averagePoint, HIPS } from '../../geometry';
import { distanceFromRest } from '../../signal';

/**
 * How far the hips have dropped below standing, in torso lengths. Standing is the rest
 * position, and hip height is the clearest sign of squat depth from any view.
 */
export function squatRepSignal(clip: ClipContext): (number | null)[] {
  const hipY = clip.sequence.frames.map((frame) => averagePoint(frame, HIPS)?.y ?? null);
  // y grows downwards, so standing is the smallest hip y.
  return distanceFromRest(hipY, 'min', clip.torsoLength);
}
