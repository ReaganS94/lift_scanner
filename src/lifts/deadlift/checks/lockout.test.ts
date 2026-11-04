import { describe, expect, it } from 'vitest';
import { LANDMARK, type LandmarkName, type RepContext } from '../../../core';
import { cleanPoses } from '../../../signal';
import {
  between,
  DEADLIFT_SETUP,
  sideDeadliftRep,
  type DeadliftPosition,
} from '../../../testing/deadlift-pose';
import { jitteredSequence, seededRandom } from '../../../testing/noise';
import { setVisibility } from '../../../testing/synthetic-pose';
import { lockout } from './lockout';

/** A rep from the floor up to `top`. */
function repTo(top: DeadliftPosition): RepContext {
  return sideDeadliftRep((t) => between(DEADLIFT_SETUP, top, t));
}

describe('deadlift lockout', () => {
  it('passes hips and knees locked out, and points at the top', () => {
    expect(lockout.evaluate(sideDeadliftRep())).toMatchObject({
      checkId: 'deadlift.lockout',
      status: 'pass',
      message: 'Hips and knees locked out.',
      frameIndex: 40,
    });
  });

  it('counts leaning back at the top as locked out', () => {
    expect(lockout.evaluate(repTo({ shin: 0, thigh: 0, torso: -10 }))).toMatchObject({
      status: 'pass',
    });
  });

  it('warns when the hips stop a little short', () => {
    expect(lockout.evaluate(repTo({ shin: 0, thigh: 5, torso: 10 }))).toMatchObject({
      status: 'warn',
      message: 'Hips stayed 15° short of locked out.',
    });
  });

  it('warns when the knees stay bent with the hips straight', () => {
    // Thigh and shin each 8° off vertical, torso upright over the hips.
    expect(lockout.evaluate(repTo({ shin: 8, thigh: 8, torso: -8 }))).toMatchObject({
      status: 'warn',
      message: 'Knees stayed 16° bent at the top.',
    });
  });

  it('fails a soft lockout at both joints', () => {
    expect(lockout.evaluate(repTo({ shin: 5, thigh: 15, torso: 10 }))).toMatchObject({
      status: 'fail',
      message: 'Hips stayed 25° and knees 20° short of locked out.',
    });
  });

  it('skips a rep where the knee is hidden at the top', () => {
    const context = sideDeadliftRep(undefined, (landmarks, i) => {
      if (i >= 30 && i <= 50) setVisibility(landmarks, 'leftKnee', 0);
      return landmarks;
    });
    expect(lockout.evaluate(context)).toMatchObject({ status: 'skipped' });
  });

  it('rarely flags a full lockout when the points jitter', () => {
    const everyPoint = Object.keys(LANDMARK) as LandmarkName[];
    const random = seededRandom(1);
    const passes = Array.from({ length: 200 }, () => {
      const clean = sideDeadliftRep();
      const noisy = jitteredSequence(clean.sequence, everyPoint, 0.006, random);
      return lockout.evaluate({ ...clean, sequence: cleanPoses(noisy) }).status;
    }).filter((status) => status === 'pass').length;
    expect(passes).toBeGreaterThanOrEqual(194);
  });
});
