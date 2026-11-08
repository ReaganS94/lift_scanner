import type { BodySide, PoseFrame } from '../../../../core';
import { sidePoint, type Facing } from '../../../../geometry';

/**
 * Which way the lifter faces in a setup photo: at the setup the shoulders sit well ahead of
 * the hips, so that's the way they face. Null when either wasn't seen.
 */
export function setupFacing(pose: PoseFrame, side: BodySide): Facing | null {
  const shoulder = sidePoint(pose, side, 'Shoulder');
  const hip = sidePoint(pose, side, 'Hip');
  if (!shoulder || !hip || shoulder.x === hip.x) return null;
  return shoulder.x > hip.x ? 1 : -1;
}
