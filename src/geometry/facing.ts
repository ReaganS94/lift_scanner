import type { BodySide, PoseFrame } from '../core';
import type { Facing } from './angles';
import { pointAt } from './landmark-points';
import { sidePoint } from './body-side';

/**
 * Below this horizontal gap, in frame heights, two points are treated as level and give no
 * direction.
 */
const MIN_GAP = 0.005;

/**
 * Which way a lifter seen from the side faces in one frame: the way their toes point from the
 * heel, or failing that, the way the nose points from the ear. Null when neither was seen
 * clearly. For a single photo, where there's no movement to tell direction from.
 */
export function facingOf(frame: PoseFrame, side: BodySide): Facing | null {
  const pairs = [
    [sidePoint(frame, side, 'Heel'), sidePoint(frame, side, 'FootIndex')],
    [pointAt(frame, side === 'left' ? 'leftEar' : 'rightEar'), pointAt(frame, 'nose')],
  ] as const;
  for (const [back, front] of pairs) {
    if (back && front && Math.abs(front.x - back.x) >= MIN_GAP) return front.x > back.x ? 1 : -1;
  }
  return null;
}
