import {
  PHOTO_FRAME,
  type CheckResult,
  type PhotoContext,
  type PositionCheck,
} from '../../../../core';
import { jointAngle, sidePoint } from '../../../../geometry';

/**
 * Bend at the elbow, in degrees, that still counts as straight. Some allowance is needed: the
 * model's elbow point sits on the joint's centre, so a straight arm reads a few degrees bent.
 */
const PASS_UP_TO_DEGREES = 15;

const ID = 'deadlift.setup.arms-straight';

/**
 * Straight arms at the setup. Bent arms pulling the bar tend to snap straight as it leaves the
 * floor, which jerks the bar. Only warns: the elbow point is rough. Filmed side-on, the near
 * plate often hides the hand, and then this can't be measured.
 */
export const armsStraight: PositionCheck = {
  id: ID,
  label: 'Straight arms',
  supportedViews: ['side'],
  focus: ['shoulder', 'elbow', 'wrist'],
  evaluate({ pose, nearSide }: PhotoContext): CheckResult {
    const shoulder = sidePoint(pose, nearSide, 'Shoulder');
    const elbow = sidePoint(pose, nearSide, 'Elbow');
    const wrist = sidePoint(pose, nearSide, 'Wrist');
    const angle = shoulder && elbow && wrist ? jointAngle(shoulder, elbow, wrist) : null;
    if (angle === null) {
      return {
        checkId: ID,
        status: 'skipped',
        message: "The arm wasn't seen clearly. The plate may hide the hand.",
      };
    }

    const bend = Math.round(180 - angle);
    const measured = { checkId: ID, value: 180 - angle, frameIndex: PHOTO_FRAME };
    if (bend <= PASS_UP_TO_DEGREES) {
      return { ...measured, status: 'pass', message: 'Arms are straight.' };
    }
    return {
      ...measured,
      status: 'warn',
      message: `Elbows are bent ${String(bend)}°. Pull the slack out with straight arms.`,
    };
  },
};
