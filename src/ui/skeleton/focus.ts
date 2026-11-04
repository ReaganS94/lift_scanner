import type { BodyJoint, LandmarkName } from '../../core';

const JOINTS: readonly BodyJoint[] = ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle'];

/** The side-less joint a landmark is, e.g. 'knee' for 'leftKnee'. Null for other points. */
export function jointOf(name: LandmarkName): BodyJoint | null {
  const joint = name.replace(/^(left|right)/, '').toLowerCase();
  return JOINTS.find((candidate) => candidate === joint) ?? null;
}

/** Whether a line between two landmarks joins two of the focused joints. */
export function isFocusSegment(
  from: LandmarkName,
  to: LandmarkName,
  focus: ReadonlySet<BodyJoint>,
): boolean {
  const a = jointOf(from);
  const b = jointOf(to);
  return a !== null && b !== null && focus.has(a) && focus.has(b);
}
