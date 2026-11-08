import {
  PHOTO_FRAME,
  type CheckResult,
  type PhotoContext,
  type PositionCheck,
} from '../../../../core';
import { angleFromVertical, sidePoint } from '../../../../geometry';
import { torsoLeanVerdict } from '../../checks/torso-angle';

const ID = 'squat.bottom.torso-angle';

/** How far the torso leans forward in a photo of the bottom, judged like the video check. */
export const bottomTorsoAngle: PositionCheck = {
  id: ID,
  label: 'Torso angle',
  supportedViews: ['side'],
  focus: ['shoulder', 'hip'],
  evaluate({ pose, nearSide }: PhotoContext): CheckResult {
    const hip = sidePoint(pose, nearSide, 'Hip');
    const shoulder = sidePoint(pose, nearSide, 'Shoulder');
    const lean = hip && shoulder ? angleFromVertical(hip, shoulder) : null;
    if (lean === null) {
      return {
        checkId: ID,
        status: 'skipped',
        message: "The hip or shoulder wasn't seen clearly.",
      };
    }
    return {
      checkId: ID,
      value: lean,
      frameIndex: PHOTO_FRAME,
      ...torsoLeanVerdict(lean, 'at the bottom'),
    };
  },
};
