import {
  PHOTO_FRAME,
  type CheckResult,
  type ClipContext,
  type LiftPosition,
  type PhotoContext,
  type PoseFrame,
  type PoseSequence,
  type PositionCheck,
} from '../core';
import type { PhotoReport } from '../report';
import { correctedClip, MAX_CORRECTED_DEGREES } from './correct-for-camera-angle';
import { describeViews } from './describe-views';

/**
 * A photo is analysed as a clip of one frame, so the same steps that prepare a video (picking
 * the lifter, cleaning, guessing the view) prepare a photo too: pass this to prepareClip.
 * The frame rate is 1 so cleanup has nothing to smooth or fill.
 */
export function photoAsClip(pose: PoseFrame, aspectRatio: number): PoseSequence {
  return { sampleFps: 1, aspectRatio, frames: [{ ...pose, timeMs: 0 }] };
}

/**
 * After the user confirms the view: runs every check of the position on the photo. A side view
 * taken at an angle is corrected for it first, as for a video. A check that doesn't support
 * the view is reported as skipped rather than run.
 */
export function analyzePhoto(given: ClipContext, position: LiftPosition): PhotoReport {
  const clip = correctedClip(given);
  const pose = clip.sequence.frames[PHOTO_FRAME];
  const context: PhotoContext | null = pose
    ? { pose, view: clip.view, torsoLength: clip.torsoLength, nearSide: clip.nearSide }
    : null;

  return {
    positionId: position.id,
    view: clip.view,
    nearSide: clip.nearSide,
    ...(clip.view === 'side' && clip.angleFromSide !== undefined
      ? { correctedForDegrees: Math.min(clip.angleFromSide, MAX_CORRECTED_DEGREES) }
      : {}),
    results: position.checks.map((check) => runCheck(check, context)),
  };
}

function runCheck(check: PositionCheck, context: PhotoContext | null): CheckResult {
  if (!context) return { checkId: check.id, status: 'skipped', message: 'No pose was found.' };
  if (!check.supportedViews.includes(context.view)) {
    return {
      checkId: check.id,
      status: 'skipped',
      message: `Needs a ${describeViews(check.supportedViews)} view.`,
    };
  }
  return check.evaluate(context);
}
