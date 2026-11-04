import type { BodySide, PoseFrame, RepContext } from '../../core';
import { angleFromVertical, sidePoint } from '../../geometry';
import { repFrames } from '../../signal';

/**
 * The hips are lowest at the rep's turn frame. The bottom is looked for within this long
 * either side of it: enough to allow for the thigh being deepest a frame or two away from the
 * hips being lowest, never so far that a frame well away from the bottom gets judged.
 */
const BOTTOM_WINDOW_SECONDS = 0.25;

/** The bottom of one squat rep, as seen on the near side of a side view. */
export interface SquatBottom {
  /** Index of the frame in the whole clip. */
  readonly frameIndex: number;
  readonly frame: PoseFrame;
  /** See thighBelowParallel(). */
  readonly thighBelowParallel: number;
}

/**
 * How far the thigh sits below parallel, in degrees, measured from the hip and knee on one
 * side: 0 means the hip is level with the knee, positive means the hip is lower, and -90 is
 * standing. Null if the hip or knee wasn't seen clearly.
 */
export function thighBelowParallel(frame: PoseFrame, side: BodySide): number | null {
  const hip = sidePoint(frame, side, 'Hip');
  const knee = sidePoint(frame, side, 'Knee');
  if (!hip || !knee) return null;
  const fromVertical = angleFromVertical(knee, hip);
  return fromVertical === null ? null : fromVertical - 90;
}

/**
 * The rep's deepest frame: near where the hips were lowest, the frame where the near-side
 * thigh is furthest below parallel. Null if the hip or knee wasn't seen around that point.
 */
export function squatBottom(context: RepContext): SquatBottom | null {
  const window = BOTTOM_WINDOW_SECONDS * context.sequence.sampleFps;
  let bottom: SquatBottom | null = null;
  for (const { frame, index } of repFrames(context)) {
    if (Math.abs(index - context.rep.turnFrame) > window) continue;
    const angle = thighBelowParallel(frame, context.nearSide);
    if (angle !== null && (bottom === null || angle > bottom.thighBelowParallel)) {
      bottom = { frameIndex: index, frame, thighBelowParallel: angle };
    }
  }
  return bottom;
}
