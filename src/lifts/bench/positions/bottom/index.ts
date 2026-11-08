import type { LiftPosition } from '../../../../core';
import { forearmsVertical } from './forearms-vertical';
import { bottomTouchPoint } from './touch-point';

/** The bottom of a bench press, with the bar on the chest. */
export const benchBottomPosition: LiftPosition = {
  id: 'bench.bottom',
  name: 'Bottom',
  description: 'With the bar touching your chest, before you press.',
  checks: [forearmsVertical, bottomTouchPoint],
};
