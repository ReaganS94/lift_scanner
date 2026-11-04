/**
 * The squat's real checks, run through the whole pipeline (cleanup, rep finding, checks) on a
 * synthetic set, so the pieces are known to fit together.
 */
import { describe, expect, it } from 'vitest';
import { squat } from '../lifts/squat';
import { repWave, sequenceOf } from '../testing/synthetic-pose';
import { sideSquatFigure } from '../testing/squat-pose';
import { analyzeSet } from './analyze-set';
import { prepareClip } from './prepare-clip';

/** One rep each: below parallel, a little above, and well above. */
const DEPTHS = [10, -5, -25];

function squatSet() {
  return DEPTHS.flatMap((depth) =>
    repWave({ reps: 1, repFrames: 60, restFrames: 15, amplitude: 1 }).map((t) =>
      sideSquatFigure({ thighBelowParallel: -90 + t * (depth + 90), torsoLean: 5 + t * 35 }),
    ),
  );
}

describe('squat report', () => {
  it('judges each rep of a side-view set', () => {
    const prepared = prepareClip(sequenceOf(squatSet()));
    const report = analyzeSet(
      {
        sequence: prepared.sequence,
        view: 'side',
        torsoLength: prepared.torsoLength ?? 0,
        nearSide: prepared.nearSide,
      },
      squat,
    );

    const statuses = report.reps.map(({ results }) =>
      Object.fromEntries(results.map((result) => [result.checkId, result.status])),
    );
    expect(statuses).toEqual([
      { 'squat.depth': 'pass', 'squat.torso-angle': 'pass', 'squat.knees-caving': 'skipped' },
      { 'squat.depth': 'warn', 'squat.torso-angle': 'pass', 'squat.knees-caving': 'skipped' },
      { 'squat.depth': 'fail', 'squat.torso-angle': 'pass', 'squat.knees-caving': 'skipped' },
    ]);
  });
});
