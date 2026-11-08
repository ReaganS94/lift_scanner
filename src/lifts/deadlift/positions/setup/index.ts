import type { LiftPosition } from '../../../../core';
import { armsStraight } from './arms-straight';
import { hipHeight } from './hip-height';
import { shouldersOverBar } from './shoulders-over-bar';

/** The deadlift setup: set over the bar, just before it leaves the floor. */
export const deadliftSetupPosition: LiftPosition = {
  id: 'deadlift.setup',
  name: 'Setup',
  description: 'Set over the bar with your grip taken, just before it leaves the floor.',
  checks: [hipHeight, shouldersOverBar, armsStraight],
};
