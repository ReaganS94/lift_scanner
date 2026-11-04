import type { ClipContext } from '../../core';
import { averagePoint, WRISTS } from '../../geometry';
import { distanceFromRest } from '../../signal';

/**
 * How far the hands have risen above the floor position, in torso lengths. The hands hold the
 * bar, so this follows the bar. A deadlift rests at the bottom between reps, which is why the
 * rest position here is the lowest point rather than standing.
 */
export function deadliftRepSignal(clip: ClipContext): (number | null)[] {
  const wristY = clip.sequence.frames.map((frame) => averagePoint(frame, WRISTS)?.y ?? null);
  // y grows downwards, so the bar on the floor is the largest wrist y.
  return distanceFromRest(wristY, 'max', clip.torsoLength);
}
