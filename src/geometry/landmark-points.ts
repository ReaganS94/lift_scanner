import { LANDMARK, type LandmarkName, type PoseFrame } from '../core';
import type { Vec2 } from './vector';

/** Points the model is less sure about than this are treated as not seen. */
export const DEFAULT_MIN_VISIBILITY = 0.5;

/** The position of one landmark, or null if it wasn't seen clearly enough. */
export function pointAt(
  frame: PoseFrame,
  name: LandmarkName,
  minVisibility = DEFAULT_MIN_VISIBILITY,
): Vec2 | null {
  const landmark = frame.landmarks?.[LANDMARK[name]];
  if (!landmark || landmark.visibility < minVisibility) return null;
  return { x: landmark.x, y: landmark.y };
}

/**
 * The average position of whichever of the given landmarks were seen, or null if none were.
 * Useful in a side view, where the far shoulder or hip is often hidden behind the body.
 */
export function averagePoint(
  frame: PoseFrame,
  names: readonly LandmarkName[],
  minVisibility = DEFAULT_MIN_VISIBILITY,
): Vec2 | null {
  const points = names
    .map((name) => pointAt(frame, name, minVisibility))
    .filter((point): point is Vec2 => point !== null);
  if (points.length === 0) return null;

  const sum = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }));
  return { x: sum.x / points.length, y: sum.y / points.length };
}

export const SHOULDERS: readonly LandmarkName[] = ['leftShoulder', 'rightShoulder'];
export const HIPS: readonly LandmarkName[] = ['leftHip', 'rightHip'];
export const WRISTS: readonly LandmarkName[] = ['leftWrist', 'rightWrist'];
