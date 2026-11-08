/**
 * Builders for made-up photo poses, for the position checks' tests. App code must not import
 * this folder.
 */
import { LANDMARK, type LandmarkName, type PhotoContext, type View } from '../core';
import { setVisibility, standingFigure } from './synthetic-pose';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface PhotoPoseOptions {
  /** The view the figure starts from and the check is run for. Side by default. */
  readonly view?: View;
  /** Points the model "couldn't see": visibility 0. */
  readonly hidden?: readonly LandmarkName[];
}

/**
 * A photo of a standing lifter with the given points moved to where they're given, in frame
 * heights. The near side is the left. The torso length is measured from the points.
 */
export function photoPose(
  points: Partial<Record<LandmarkName, Point>>,
  options: PhotoPoseOptions = {},
): PhotoContext {
  const view = options.view ?? 'side';
  const landmarks = standingFigure(view);
  for (const [name, point] of Object.entries(points) as [LandmarkName, Point][]) {
    landmarks[LANDMARK[name]] = { x: point.x, y: point.y, z: 0, visibility: 0.95 };
  }
  for (const name of options.hidden ?? []) setVisibility(landmarks, name, 0);

  const at = (name: LandmarkName) => landmarks[LANDMARK[name]] ?? { x: 0, y: 0 };
  const middle = (a: LandmarkName, b: LandmarkName) => ({
    x: (at(a).x + at(b).x) / 2,
    y: (at(a).y + at(b).y) / 2,
  });
  const shoulders = middle('leftShoulder', 'rightShoulder');
  const hips = middle('leftHip', 'rightHip');
  return {
    pose: { timeMs: 0, landmarks },
    view,
    torsoLength: Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y),
    nearSide: 'left',
  };
}

/** A point `length` away from `from`, at `degrees` clockwise from straight up. */
export function towards(from: Point, degrees: number, length: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return { x: from.x + Math.sin(radians) * length, y: from.y - Math.cos(radians) * length };
}

/** The same point for both sides of the body, as seen straight side-on. */
export function bothSides(
  joint: 'Shoulder' | 'Elbow' | 'Wrist' | 'Hip' | 'Knee' | 'Ankle' | 'Heel' | 'FootIndex',
  point: Point,
): Partial<Record<LandmarkName, Point>> {
  return { [`left${joint}`]: point, [`right${joint}`]: point };
}
