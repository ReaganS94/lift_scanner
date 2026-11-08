import type { CheckResult, FormCheck, RepContext } from '../../../core';
import { squatBottom } from '../bottom';

/**
 * Deep enough: the hip joint at or below the knee joint at the bottom, so the thigh is at
 * least parallel. The competition rule (hip crease below the top of the knee) is a little
 * deeper than this, but the model finds joint centres, not the crease or the top of the knee.
 */
const PASS_AT_DEGREES = 0;
/** Short of parallel by up to this much is a warning rather than a fail. */
const WARN_WITHIN_DEGREES = 10;

const ID = 'squat.depth';

/** Squat depth: how far the thigh got below parallel at the bottom of the rep. */
export const depth: FormCheck = {
  id: ID,
  label: 'Depth',
  supportedViews: ['side'],
  focus: ['hip', 'knee'],
  evaluate(context: RepContext): CheckResult {
    const bottom = squatBottom(context);
    if (!bottom) {
      return {
        checkId: ID,
        status: 'skipped',
        message: "The hip or knee wasn't seen clearly at the bottom of this rep.",
      };
    }

    return {
      checkId: ID,
      value: bottom.thighBelowParallel,
      frameIndex: bottom.frameIndex,
      ...depthVerdict(bottom.thighBelowParallel),
    };
  },
};

/**
 * How a depth is judged, from how far the thigh got below parallel in degrees. Shared with the
 * squat bottom photo check.
 */
export function depthVerdict(thighBelowParallel: number): {
  status: 'pass' | 'warn' | 'fail';
  message: string;
} {
  // Judged on whole degrees, so the status always agrees with the number shown.
  const degrees = Math.round(thighBelowParallel);
  if (degrees >= PASS_AT_DEGREES) {
    const message =
      degrees === 0 ? 'Hips reached parallel.' : `Hips went ${String(degrees)}° below parallel.`;
    return { status: 'pass', message };
  }
  return {
    status: PASS_AT_DEGREES - degrees <= WARN_WITHIN_DEGREES ? 'warn' : 'fail',
    message: `Hips stopped ${String(-degrees)}° above parallel.`,
  };
}
