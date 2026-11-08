import {
  PHOTO_FRAME,
  type CheckResult,
  type PhotoContext,
  type PositionCheck,
} from '../../../../core';
import { shareAlongBody, touchVerdict } from '../../checks/touch-point';

const ID = 'bench.bottom.touch-point';

/** Where the bar touches the chest in a photo of the bottom, judged like the video check. */
export const bottomTouchPoint: PositionCheck = {
  id: ID,
  label: 'Touch point',
  supportedViews: ['side'],
  focus: ['shoulder', 'wrist', 'hip'],
  evaluate({ pose, nearSide }: PhotoContext): CheckResult {
    const along = shareAlongBody(pose, nearSide);
    if (along === null) {
      return {
        checkId: ID,
        status: 'skipped',
        message: "The wrist, shoulder or hip wasn't seen clearly.",
      };
    }
    return { checkId: ID, value: along, frameIndex: PHOTO_FRAME, ...touchVerdict(along) };
  },
};
