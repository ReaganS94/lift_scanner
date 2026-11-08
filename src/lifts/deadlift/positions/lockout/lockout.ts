import {
  PHOTO_FRAME,
  type CheckResult,
  type PhotoContext,
  type PositionCheck,
} from '../../../../core';
import { facingOf } from '../../../../geometry';
import { bendsAt, lockoutVerdict, worstOf } from '../../checks/lockout';

const ID = 'deadlift.lockout.lockout';

/**
 * Hips and knees straight at the top, judged like the video check. A photo has no bar track,
 * so a knee hidden behind the plate is only skipped when the model says it couldn't see it.
 */
export const lockoutPhoto: PositionCheck = {
  id: ID,
  label: 'Lockout',
  supportedViews: ['side'],
  focus: ['shoulder', 'hip', 'knee', 'ankle'],
  evaluate({ pose, nearSide }: PhotoContext): CheckResult {
    const facing = facingOf(pose, nearSide);
    const bends = facing && bendsAt(pose, nearSide, facing, null);
    if (!bends) {
      return {
        checkId: ID,
        status: 'skipped',
        message: "The hips, legs, feet or head weren't seen clearly enough to measure.",
      };
    }
    return {
      checkId: ID,
      value: worstOf(bends),
      frameIndex: PHOTO_FRAME,
      ...lockoutVerdict(bends),
    };
  },
};
