import type { LiftDefinition } from '../../core';
import { benchRepSignal } from './rep-signal';

export const bench: LiftDefinition = {
  id: 'bench',
  name: 'Bench press',
  supportedViews: ['side', 'front', 'back'],
  repSignal: benchRepSignal,
  repDetection: {
    // Bar travel is roughly arm length minus chest depth: about half a torso length.
    minAmplitude: 0.25,
    minDurationSeconds: 0.6,
  },
  checks: [],
};
