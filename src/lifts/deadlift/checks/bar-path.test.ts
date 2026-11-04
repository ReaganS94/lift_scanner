import { describe, expect, it } from 'vitest';
import { LANDMARK, type LandmarkName } from '../../../core';
import { cleanPoses } from '../../../signal';
import {
  between,
  DEADLIFT_LOCKOUT,
  DEADLIFT_SETUP,
  sideDeadliftRep,
} from '../../../testing/deadlift-pose';
import { jitteredSequence, seededRandom } from '../../../testing/noise';
import { setVisibility } from '../../../testing/synthetic-pose';
import { barPath } from './bar-path';

/** A pull where the bar swings forward by up to `peak` frame heights mid-pull and back. */
function swinging(peak: number) {
  return sideDeadliftRep((t) => ({
    ...between(DEADLIFT_SETUP, DEADLIFT_LOCKOUT, t),
    barAhead: peak * Math.sin(Math.PI * t),
  }));
}

describe('deadlift bar path', () => {
  it('passes a bar that stays over the middle of the foot', () => {
    expect(barPath.evaluate(sideDeadliftRep())).toMatchObject({
      checkId: 'deadlift.bar-path',
      status: 'pass',
      message: 'The bar stayed close to the legs.',
    });
  });

  it('warns when the bar drifts a little forward, and points at the furthest moment', () => {
    // 0.04 frame heights is 0.16 torso lengths; a little of it has happened by liftoff.
    const result = barPath.evaluate(swinging(0.04));
    expect(result).toMatchObject({
      status: 'warn',
      message: 'The bar drifted forward during the pull, by about 14% of your torso length.',
    });
    expect(result.status !== 'skipped' && result.frameIndex).toBe(25);
  });

  it('fails a bar that swings well away from the legs', () => {
    expect(barPath.evaluate(swinging(0.08))).toMatchObject({ status: 'fail' });
  });

  it('passes a bar that moves back towards the body', () => {
    expect(barPath.evaluate(swinging(-0.04))).toMatchObject({ status: 'pass' });
  });

  it('skips a rep where the hands are hidden at the floor', () => {
    const context = sideDeadliftRep(undefined, (landmarks, i) => {
      if (i < 20) {
        setVisibility(landmarks, 'leftWrist', 0);
        setVisibility(landmarks, 'rightWrist', 0);
      }
      return landmarks;
    });
    expect(barPath.evaluate(context)).toMatchObject({ status: 'skipped' });
  });

  it('rarely flags a straight bar path when the points jitter', () => {
    const everyPoint = Object.keys(LANDMARK) as LandmarkName[];
    const random = seededRandom(1);
    const passes = Array.from({ length: 200 }, () => {
      const clean = sideDeadliftRep();
      const noisy = jitteredSequence(clean.sequence, everyPoint, 0.006, random);
      return barPath.evaluate({ ...clean, sequence: cleanPoses(noisy) }).status;
    }).filter((status) => status === 'pass').length;
    expect(passes).toBeGreaterThanOrEqual(194);
  });
});
