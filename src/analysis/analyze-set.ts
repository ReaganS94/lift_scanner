import type {
  CheckResult,
  ClipContext,
  FormCheck,
  LiftDefinition,
  RepContext,
  View,
} from '../core';
import { segmentReps } from '../reps';
import { correctForCameraAngle, MAX_CORRECTED_DEGREES } from './correct-for-camera-angle';
import type { SetReport } from '../report';

/**
 * Step 3, after the user confirms the view: finds the reps and runs every check on each one.
 * A side view filmed at an angle is first corrected for it, so all of them measure the
 * corrected poses.
 * A check that doesn't support the view is reported as skipped rather than run.
 */
export function analyzeSet(given: ClipContext, lift: LiftDefinition): SetReport {
  const clip = correctedClip(given);
  const repSignal = lift.repSignal(clip);
  const reps = segmentReps(repSignal, clip.sequence.sampleFps, lift.repDetection);

  return {
    liftId: lift.id,
    view: clip.view,
    nearSide: clip.nearSide,
    ...(clip.view === 'side' && clip.angleFromSide !== undefined
      ? { correctedForDegrees: Math.min(clip.angleFromSide, MAX_CORRECTED_DEGREES) }
      : {}),
    sampleFps: clip.sequence.sampleFps,
    repSignal,
    reps: reps.map((rep) => ({
      rep,
      results: lift.checks.map((check) => runCheck(check, { ...clip, rep })),
    })),
  };
}

/** A side view with its camera angle corrected for (see correctForCameraAngle). */
function correctedClip(clip: ClipContext): ClipContext {
  if (clip.view !== 'side' || clip.angleFromSide === undefined) return clip;
  return { ...clip, sequence: correctForCameraAngle(clip.sequence, clip.angleFromSide) };
}

function runCheck(check: FormCheck, context: RepContext): CheckResult {
  if (!check.supportedViews.includes(context.view)) {
    return {
      checkId: check.id,
      status: 'skipped',
      message: `Needs a ${describeViews(check.supportedViews)} view.`,
    };
  }
  return check.evaluate(context);
}

function describeViews(views: readonly View[]): string {
  return views.join(' or ');
}
