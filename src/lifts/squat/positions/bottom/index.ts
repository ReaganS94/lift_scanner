import type { LiftPosition } from '../../../../core';
import { bottomDepth } from './depth';
import { kneesOverFeet } from './knees-over-feet';
import { bottomTorsoAngle } from './torso-angle';

/** The bottom of a squat, held for the photo or picked as the lowest moment. */
export const squatBottomPosition: LiftPosition = {
  id: 'squat.bottom',
  name: 'Bottom',
  description: 'At the lowest point of the squat, before you stand up.',
  checks: [bottomDepth, bottomTorsoAngle, kneesOverFeet],
};
