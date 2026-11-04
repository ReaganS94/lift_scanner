import type { LiftDefinition } from '../../core';
import { squatRepSignal } from './rep-signal';

export const squat: LiftDefinition = {
  id: 'squat',
  name: 'Back squat',
  supportedViews: ['side', 'front', 'back'],
  repSignal: squatRepSignal,
  repDetection: {
    // Even a shallow squat drops the hips by about a third of a torso length.
    minAmplitude: 0.3,
    minDurationSeconds: 0.8,
  },
  checks: [],
};
