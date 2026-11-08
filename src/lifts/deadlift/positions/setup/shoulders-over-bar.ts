import {
  PHOTO_FRAME,
  type CheckResult,
  type PhotoContext,
  type PositionCheck,
} from '../../../../core';
import { forwardTilt, sidePoint } from '../../../../geometry';
import { setupFacing } from './facing';

/**
 * The arm hangs from the shoulder to the bar, so its tilt says where the shoulders are against
 * the bar: tilting forward (towards where the lifter faces) means the shoulders are behind it.
 * Arms tilted forward by more than this many degrees get a warning.
 */
const BEHIND_ABOVE_DEGREES = 5;
/** Arms tilted back by more than this put the shoulders well ahead of the bar. */
const FAR_AHEAD_BELOW_DEGREES = -25;

const ID = 'deadlift.setup.shoulders-over-bar';

/**
 * Shoulders over the bar, or a little ahead of it, at the setup. Measured along the arm rather
 * than to the hands, because filmed side-on the near plate usually hides the hands: the elbow
 * is above the plate, so the shoulder-to-elbow line is used when the wrist can't be seen.
 */
export const shouldersOverBar: PositionCheck = {
  id: ID,
  label: 'Shoulders over the bar',
  supportedViews: ['side'],
  focus: ['shoulder', 'elbow', 'wrist'],
  evaluate({ pose, nearSide }: PhotoContext): CheckResult {
    const shoulder = sidePoint(pose, nearSide, 'Shoulder');
    const hand = sidePoint(pose, nearSide, 'Wrist') ?? sidePoint(pose, nearSide, 'Elbow');
    const facing = setupFacing(pose, nearSide);
    const tilt = shoulder && hand && facing ? forwardTilt(shoulder, hand, facing) : null;
    if (tilt === null) {
      return {
        checkId: ID,
        status: 'skipped',
        message: "The shoulder, hip or arm wasn't seen clearly.",
      };
    }

    const degrees = Math.round(tilt);
    const measured = { checkId: ID, value: tilt, frameIndex: PHOTO_FRAME };
    if (degrees > BEHIND_ABOVE_DEGREES) {
      return {
        ...measured,
        status: 'warn',
        message: `Shoulders are behind the bar: the arms tilt ${String(degrees)}° forward. The hips may be set too low.`,
      };
    }
    if (degrees < FAR_AHEAD_BELOW_DEGREES) {
      return {
        ...measured,
        status: 'warn',
        message: `Shoulders are well ahead of the bar: the arms tilt ${String(-degrees)}° back. The bar may be too far from the shins.`,
      };
    }
    return {
      ...measured,
      status: 'pass',
      message:
        degrees >= -BEHIND_ABOVE_DEGREES
          ? 'Shoulders are over the bar.'
          : 'Shoulders are just ahead of the bar.',
    };
  },
};
