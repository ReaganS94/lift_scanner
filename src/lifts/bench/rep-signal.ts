import type { ClipContext } from '../../core';
import { averagePoint, WRISTS } from '../../geometry';
import { distanceFromRest } from '../../signal';

/**
 * How far the hands have lowered from lockout, in torso lengths. The hands hold the bar, so
 * this follows the bar down to the chest and back. Lockout is the rest position.
 */
export function benchRepSignal(clip: ClipContext): (number | null)[] {
  const wristY = clip.sequence.frames.map((frame) => averagePoint(frame, WRISTS)?.y ?? null);
  // y grows downwards, so lockout is the smallest wrist y.
  return distanceFromRest(wristY, 'min', clip.torsoLength);
}
