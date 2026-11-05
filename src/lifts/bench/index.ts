import type { LiftDefinition } from '../../core';
import { lockout } from './checks/lockout';
import { touchPoint } from './checks/touch-point';
import { unevenPress } from './checks/uneven-press';
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
    // Filmed from low near the feet, the torso looks short, and the hands' wobble, measured in
    // torso lengths, passes minAmplitude: one such clip had two full reps (1.5 and 1.7) and
    // five wobbles of 0.3 to 0.6. Less than 40% of the set's biggest press isn't a rep.
    minShareOfBiggestRep: 0.4,
  },
  checks: [touchPoint, lockout, unevenPress],
};
