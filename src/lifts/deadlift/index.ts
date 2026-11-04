import type { LiftDefinition } from '../../core';
import { barPath } from './checks/bar-path';
import { hipsRiseFirst } from './checks/hips-rise-first';
import { lockout } from './checks/lockout';
import { deadliftRepSignal } from './rep-signal';

export const deadlift: LiftDefinition = {
  id: 'deadlift',
  name: 'Deadlift',
  supportedViews: ['side', 'front', 'back'],
  repSignal: deadliftRepSignal,
  repDetection: {
    // The bar travels from mid-shin to the top of the thighs: well over half a torso length.
    minAmplitude: 0.4,
    minDurationSeconds: 0.8,
  },
  checks: [hipsRiseFirst, lockout, barPath],
};
