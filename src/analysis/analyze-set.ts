import type {
  CheckResult,
  ClipContext,
  FormCheck,
  LiftDefinition,
  RepContext,
  View,
} from '../core';
import { segmentReps } from '../reps';
import type { SetReport } from '../report';

/**
 * Step 3, after the user confirms the view: finds the reps and runs every check on each one.
 * A check that doesn't support the view is reported as skipped rather than run.
 */
export function analyzeSet(clip: ClipContext, lift: LiftDefinition): SetReport {
  const repSignal = lift.repSignal(clip);
  const reps = segmentReps(repSignal, clip.sequence.sampleFps, lift.repDetection);

  return {
    liftId: lift.id,
    view: clip.view,
    nearSide: clip.nearSide,
    sampleFps: clip.sequence.sampleFps,
    repSignal,
    reps: reps.map((rep) => ({
      rep,
      results: lift.checks.map((check) => runCheck(check, { ...clip, rep })),
    })),
  };
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
