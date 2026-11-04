import type { CheckResult, FormCheck, RepContext } from '../../../core';
import { angleFromVertical, sidePoint } from '../../../geometry';
import { squatBottom } from '../bottom';

/**
 * Forward lean of the torso at the bottom, in degrees from vertical, above which the rep gets a
 * warning. Set loose enough that a typical low-bar squat, which leans more than a high-bar
 * one, passes.
 *
 * This check never fails a rep. How far the torso leans mostly comes down to build (thigh
 * length against torso length) and bar position rather than technique, so a long-legged
 * lifter can lean past any fixed line on every good rep. The faults that do show up as lean,
 * such as the chest dropping out of the hole, need their own checks.
 */
const PASS_UP_TO_DEGREES = 55;

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
    const measured = { checkId: ID, value: lean, frameIndex: bottom.frameIndex };
    if (degrees <= PASS_UP_TO_DEGREES) {
      return {
        ...measured,
        status: 'pass',
        message: `Torso leaned ${String(degrees)}° forward at the bottom.`,
      };
    }
    return {
      ...measured,
      status: 'warn',
      message: `Torso leaned ${String(degrees)}° forward at the bottom, more than usual.`,
    };
  },
};
