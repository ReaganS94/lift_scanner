import type { LiftDefinition } from '../../core';
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
  checks: [],
};
