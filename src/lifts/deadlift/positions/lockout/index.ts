import type { LiftPosition } from '../../../../core';
import { lockoutPhoto } from './lockout';

/** The top of a deadlift, standing tall with the bar. */
export const deadliftLockoutPosition: LiftPosition = {
  id: 'deadlift.lockout',
  name: 'Lockout',
  description: 'Standing tall at the top, with the bar against your thighs.',
  checks: [lockoutPhoto],
};
