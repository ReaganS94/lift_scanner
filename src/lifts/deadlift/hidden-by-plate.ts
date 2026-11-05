import type { BarPoint } from '../../core';
import type { Vec2 } from '../../geometry';

/**
 * Whether a body point falls inside the near plate's circle in the frame. From the side the
 * plate is between the camera and the legs, so a point there can't be seen: the pose model only
 * guesses it, often with high confidence. At lockout the plate sits over the knees.
 */
export function hiddenByPlate(point: Vec2, plate: BarPoint | null | undefined): boolean {
  return !!plate && Math.hypot(point.x - plate.x, point.y - plate.y) < plate.radius;
}
