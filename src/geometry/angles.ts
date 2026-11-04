import { dot, length, subtract, type Vec2 } from './vector';

const RADIANS_TO_DEGREES = 180 / Math.PI;

/** Below this length two points are treated as the same point, so no angle can be measured. */
const MIN_SEGMENT_LENGTH = 1e-9;

/**
 * The angle at `vertex` between the segments to `a` and to `c`, in degrees (0 to 180).
 * For example, the knee angle is jointAngle(hip, knee, ankle): 180 is a straight leg.
 * Returns null when either segment has no length.
 */
export function jointAngle(a: Vec2, vertex: Vec2, c: Vec2): number | null {
  const toA = subtract(a, vertex);
  const toC = subtract(c, vertex);
  const lengths = length(toA) * length(toC);
  if (lengths < MIN_SEGMENT_LENGTH) return null;

  const cosine = clamp(dot(toA, toC) / lengths, -1, 1);
  return Math.acos(cosine) * RADIANS_TO_DEGREES;
}

/**
 * How far the segment from `from` to `to` leans away from vertical, in degrees (0 to 180).
 * 0 means `to` is straight above `from`, 90 means level, 180 means straight below.
 * For example, torso lean is angleFromVertical(hip, shoulder).
 * Returns null when the segment has no length.
 */
export function angleFromVertical(from: Vec2, to: Vec2): number | null {
  // Image y grows downwards, so "up" is negative y.
  const up: Vec2 = { x: 0, y: -1 };
  return jointAngle({ x: from.x + up.x, y: from.y + up.y }, from, to);
}

/** Which way along the image's x axis the lifter faces: +1 towards the right, -1 the left. */
export type Facing = 1 | -1;

/**
 * How far the segment from `from` to `to` tips away from the vertical line through `from`, in
 * degrees (-90 to 90): positive when `to` is ahead of `from` in the direction the lifter faces,
 * negative when it is behind. The vertical is whichever of up or down the segment is closer to,
 * so it works for a torso (hip to shoulder, measured from up) and for a thigh or shin (measured
 * from down). Unlike jointAngle(), it tells leaning forward from leaning back. Returns null when
 * the segment has no length.
 */
export function forwardTilt(from: Vec2, to: Vec2, facing: Facing): number | null {
  const ahead = (to.x - from.x) * facing;
  const vertical = Math.abs(to.y - from.y);
  if (Math.hypot(ahead, vertical) < MIN_SEGMENT_LENGTH) return null;
  return Math.atan2(ahead, vertical) * RADIANS_TO_DEGREES;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
