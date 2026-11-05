import type { BarPoint, RepContext } from '../../core';
import { averagePoint, SHOULDERS, type Vec2 } from '../../geometry';
import { MIN_RISE_SHARE_OF_SHOULDERS } from './pull';

/**
 * Whether a body point falls inside the near plate's circle in the frame. From the side the
 * plate is between the camera and the legs, so a point there can't be seen: the pose model only
 * guesses it, often with high confidence. At lockout the plate sits over the knees.
 */
export function hiddenByPlate(point: Vec2, plate: BarPoint | null | undefined): boolean {
  return !!plate && Math.hypot(point.x - plate.x, point.y - plate.y) < plate.radius;
}

/**
 * The plates found in a rep, or none if they didn't move with the bar. Over the frames from the
 * rep's start to its top where the plate was found, it has to rise at least half as much as the
 * shoulders did over the same frames, as in pullOf. A round outline that isn't the bar, such as
 * the legs' curve at the floor, stays put. Measured over the frames the plate was found in, so a
 * plate first found halfway up still counts.
 */
export function platesOnTheBar(
  context: RepContext,
  plates: readonly (BarPoint | null)[],
): readonly (BarPoint | null)[] {
  const { rep, sequence } = context;
  const plateYs: number[] = [];
  const shoulderYs: number[] = [];
  for (let index = rep.startFrame; index <= rep.turnFrame; index++) {
    const plate = plates[index];
    const frame = sequence.frames[index];
    const shoulders = frame ? averagePoint(frame, SHOULDERS) : null;
    if (!plate || !shoulders) continue;
    plateYs.push(plate.y);
    shoulderYs.push(shoulders.y);
  }
  const rise = (ys: number[]) => (ys.length === 0 ? 0 : Math.max(...ys) - Math.min(...ys));
  return rise(plateYs) >= MIN_RISE_SHARE_OF_SHOULDERS * rise(shoulderYs)
    ? plates
    : plates.map(() => null);
}
