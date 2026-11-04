import type { CheckResult, FormCheck, RepContext } from '../../../core';
import { angleFromVertical, sidePoint } from '../../../geometry';
import { squatBottom } from '../bottom';

/**
 * Forward lean of the torso at the bottom, in degrees from vertical. Set loose enough that a
 * typical low-bar squat, which leans more than a high-bar one, passes.
 */
const PASS_UP_TO_DEGREES = 55;
/** Leaning past this is a fail; between the two is a warning. */
const WARN_UP_TO_DEGREES = 65;

const ID = 'squat.torso-angle';

/** How far the torso leans forward at the bottom of the rep, from hip to shoulder. */
export const torsoAngle: FormCheck = {
  id: ID,
  label: 'Torso angle',
  supportedViews: ['side'],
  evaluate(context: RepContext): CheckResult {
    const bottom = squatBottom(context);
    const hip = bottom && sidePoint(bottom.frame, context.nearSide, 'Hip');
    const shoulder = bottom && sidePoint(bottom.frame, context.nearSide, 'Shoulder');
    const lean = hip && shoulder ? angleFromVertical(hip, shoulder) : null;
    if (!bottom || lean === null) {
      return {
        checkId: ID,
        status: 'skipped',
        message: "The hip or shoulder wasn't seen clearly at the bottom of this rep.",
      };
    }

    const degrees = Math.round(lean);
    const status =
      degrees <= PASS_UP_TO_DEGREES ? 'pass' : degrees <= WARN_UP_TO_DEGREES ? 'warn' : 'fail';
    return {
      checkId: ID,
      status,
      message: `Torso leaned ${String(degrees)}° forward at the bottom.`,
      value: lean,
      frameIndex: bottom.frameIndex,
    };
  },
};
