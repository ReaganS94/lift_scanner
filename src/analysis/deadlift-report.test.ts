/**
 * The deadlift's real checks, run through the whole pipeline (cleanup, rep finding, checks) on
 * a synthetic set, so the pieces are known to fit together.
 */
import { describe, expect, it } from 'vitest';
import type { Landmark } from '../core';
import { deadlift } from '../lifts/deadlift';
import {
  between,
  DEADLIFT_LOCKOUT,
  DEADLIFT_SETUP,
  sideDeadliftFigure,
  type DeadliftPosition,
} from '../testing/deadlift-pose';
import { repWave, sequenceOf } from '../testing/synthetic-pose';
import { analyzeSet } from './analyze-set';
import { prepareClip } from './prepare-clip';

function rep(path: (t: number) => DeadliftPosition): Landmark[][] {
  return repWave({ reps: 1, repFrames: 60, restFrames: 15, amplitude: 1 }).map((t) =>
    sideDeadliftFigure(path(t)),
  );
}

const good = (t: number) => between(DEADLIFT_SETUP, DEADLIFT_LOCKOUT, t);
const softLockout = (t: number) => between(DEADLIFT_SETUP, { shin: 5, thigh: 15, torso: 10 }, t);
const drifting = (t: number) => ({ ...good(t), barAhead: 0.08 * Math.sin(Math.PI * t) });

describe('deadlift report', () => {
  it('judges each rep of a side-view set', () => {
    const prepared = prepareClip(sequenceOf([...rep(good), ...rep(softLockout), ...rep(drifting)]));
    const report = analyzeSet(
      {
        sequence: prepared.sequence,
        view: 'side',
        torsoLength: prepared.torsoLength ?? 0,
        nearSide: prepared.nearSide,
      },
      deadlift,
    );

    const statuses = report.reps.map(({ results }) =>
      Object.fromEntries(results.map((result) => [result.checkId, result.status])),
    );
    expect(statuses).toEqual([
      {
        'deadlift.hips-rise-first': 'pass',
        'deadlift.lockout': 'pass',
        'deadlift.bar-path': 'pass',
      },
      {
        'deadlift.hips-rise-first': 'pass',
        'deadlift.lockout': 'fail',
        'deadlift.bar-path': 'pass',
      },
      {
        'deadlift.hips-rise-first': 'pass',
        'deadlift.lockout': 'pass',
        'deadlift.bar-path': 'fail',
      },
    ]);
  });
});
