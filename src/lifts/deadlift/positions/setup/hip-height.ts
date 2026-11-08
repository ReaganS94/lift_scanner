import {
  PHOTO_FRAME,
  type CheckResult,
  type PhotoContext,
  type PositionCheck,
} from '../../../../core';
import { sidePoint } from '../../../../geometry';

/**
 * Hip height is measured as a share of the way up from the knees (0) to the shoulders (1).
 * Below this share the hips are about level with the knees: the start of a squat, not a pull.
 */
const LOW_BELOW = 0.1;
/**
 * Above this share the hips are close to shoulder height, a stiff-legged start. Where the hips
 * belong in between depends on build (long thighs set them higher), so only the ends warn.
 */
const HIGH_ABOVE = 0.75;

const ID = 'deadlift.setup.hip-height';

/** Where the hips sit between the knees and shoulders at the setup. */
export const hipHeight: PositionCheck = {
  id: ID,
  label: 'Hip height',
  supportedViews: ['side'],
  focus: ['shoulder', 'hip', 'knee'],
  evaluate({ pose, nearSide }: PhotoContext): CheckResult {
    const shoulder = sidePoint(pose, nearSide, 'Shoulder');
    const hip = sidePoint(pose, nearSide, 'Hip');
    const knee = sidePoint(pose, nearSide, 'Knee');
    if (!shoulder || !hip || !knee) {
      return {
        checkId: ID,
        status: 'skipped',
        message: "The shoulder, hip or knee wasn't seen clearly. The plate may hide the knee.",
      };
    }
    const span = knee.y - shoulder.y;
    if (span <= 0) {
      return {
        checkId: ID,
        status: 'skipped',
        message: 'The shoulders are no higher than the knees, so this doesn’t look like a setup.',
      };
    }

    const share = (knee.y - hip.y) / span;
    const measured = { checkId: ID, value: share, frameIndex: PHOTO_FRAME };
    if (share < 0) {
      return { ...measured, status: 'fail', message: 'Hips are below the knees, like a squat.' };
    }
    if (share < LOW_BELOW) {
      return {
        ...measured,
        status: 'warn',
        message: 'Hips are about level with the knees, lower than most pulls start.',
      };
    }
    if (share > HIGH_ABOVE) {
      return {
        ...measured,
        status: 'warn',
        message: 'Hips are close to shoulder height, a stiff-legged start.',
      };
    }
    return {
      ...measured,
      status: 'pass',
      message: 'Hips sit between the knees and shoulders.',
    };
  },
};
