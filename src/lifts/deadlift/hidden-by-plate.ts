import type { BarPoint, PoseFrame } from '../../core';
import { pointAt, type Vec2 } from '../../geometry';

/**
 * How far from a wrist, in plate radii, the plate's centre may be and still be taken as the
 * plate on the bar in the hands. The model places the wrist at the edge of the hand rather than
 * on the bar: 0.8 to 1.2 radii from the plate's centre at lockout on Reagan's clips.
 */
const WRIST_REACH_RADII = 1.5;

/**
 * Whether a body point falls inside the near plate's circle in the frame. From the side the
 * plate is between the camera and the legs, so a point there can't be seen: the pose model only
 * guesses it, often with high confidence. At lockout the plate sits over the knees.
 */
export function hiddenByPlate(point: Vec2, plate: BarPoint | null | undefined): boolean {
  return !!plate && Math.hypot(point.x - plate.x, point.y - plate.y) < plate.radius;
}

/**
 * The plate, if it is in the lifter's hands in this frame: within reach of a wrist that was
 * seen. A large round outline that isn't the bar, such as the legs' curve at the floor, is not.
 * With no wrist seen there is nothing to check against, so the plate is kept.
 */
export function plateInHands(
  frame: PoseFrame,
  plate: BarPoint | null | undefined,
): BarPoint | null {
  if (!plate) return null;
  const wrists = [pointAt(frame, 'leftWrist'), pointAt(frame, 'rightWrist')].filter(
    (wrist): wrist is Vec2 => wrist !== null,
  );
  if (wrists.length === 0) return plate;
  const held = wrists.some(
    (wrist) => Math.hypot(wrist.x - plate.x, wrist.y - plate.y) <= WRIST_REACH_RADII * plate.radius,
  );
  return held ? plate : null;
}
