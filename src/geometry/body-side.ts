import { LANDMARK, type BodySide, type LandmarkName, type PoseFrame } from '../core';
import { median } from '../signal';
import { pointAt } from './landmark-points';
import type { Vec2 } from './vector';

/** Joints that come in left/right pairs, spelled as in landmark names. */
export type PairedJoint =
  'Shoulder' | 'Elbow' | 'Wrist' | 'Hip' | 'Knee' | 'Ankle' | 'Heel' | 'FootIndex';

const MAIN_JOINTS: readonly PairedJoint[] = ['Shoulder', 'Elbow', 'Wrist', 'Hip', 'Knee', 'Ankle'];

export function sideLandmark(side: BodySide, joint: PairedJoint): LandmarkName {
  return `${side}${joint}`;
}

/** The position of a joint on one side of the body, or null if it wasn't seen clearly. */
export function sidePoint(frame: PoseFrame, side: BodySide, joint: PairedJoint): Vec2 | null {
  return pointAt(frame, sideLandmark(side, joint));
}

/**
 * In a side view the far side of the body is partly hidden, so its landmarks are guesses.
 * This picks the side the model saw more clearly over the whole clip, so checks can measure
 * the near side.
 */
export function nearSide(frames: readonly PoseFrame[]): BodySide {
  return sideVisibility(frames, 'left') >= sideVisibility(frames, 'right') ? 'left' : 'right';
}

function sideVisibility(frames: readonly PoseFrame[], side: BodySide): number {
  const indices: number[] = MAIN_JOINTS.map((joint) => LANDMARK[sideLandmark(side, joint)]);
  const values = frames.flatMap((frame) =>
    indices.map((index) => frame.landmarks?.[index]?.visibility ?? null),
  );
  return median(values) ?? 0;
}
