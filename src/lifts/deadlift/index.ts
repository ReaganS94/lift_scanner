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
  followsBar: true,
  filmingTips: [
    'From straight side-on the near plate hides your hands. That’s expected: bar path follows the plate instead, so keep the whole plate in the picture from the floor to lockout.',
    'Filming closer, higher or with the 0.5× lens won’t uncover your hands. Use the 1× lens about 3 m away, so the edges of the picture don’t bend.',
    'Don’t turn the camera to see your hands. Hip and knee angles are corrected for a camera up to about 45° off side-on, but at an angle the plate looks oval and bar path can’t be followed.',
  ],
};
