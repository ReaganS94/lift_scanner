import {
  PHOTO_FRAME,
  type CheckResult,
  type PhotoContext,
  type PositionCheck,
} from '../../../../core';
import { thighBelowParallel } from '../../bottom';
import { depthVerdict } from '../../checks/depth';

const ID = 'squat.bottom.depth';

/** Squat depth in a photo of the bottom, judged like the video check. */
export const bottomDepth: PositionCheck = {
  id: ID,
  label: 'Depth',
  supportedViews: ['side'],
  focus: ['hip', 'knee'],
  evaluate({ pose, nearSide }: PhotoContext): CheckResult {
    const thigh = thighBelowParallel(pose, nearSide);
    if (thigh === null) {
      return { checkId: ID, status: 'skipped', message: "The hip or knee wasn't seen clearly." };
    }
    return { checkId: ID, value: thigh, frameIndex: PHOTO_FRAME, ...depthVerdict(thigh) };
  },
};
