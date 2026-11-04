import { describe, expect, it } from 'vitest';
import { LANDMARK, type LandmarkName, type RepContext } from '../../../core';
import { cleanPoses } from '../../../signal';
import {
  between,
  DEADLIFT_LOCKOUT,
  DEADLIFT_SETUP,
  sideDeadliftFigure,
  sideDeadliftRep,
  type DeadliftPosition,
} from '../../../testing/deadlift-pose';
import { jitteredSequence, seededRandom } from '../../../testing/noise';
import { setVisibility } from '../../../testing/synthetic-pose';
import { hipsRiseFirst } from './hips-rise-first';

/**
 * Hips shooting up: the knees straighten while the torso tips forward to `torso`, and it stays
 * tipped until the bar is past the knees, then the lifter stands up.
 */
function hipsFirst(torso: number): (t: number) => DeadliftPosition {
  const tipped = { shin: 5, thigh: 20, torso };
  const pastKnees = { shin: 3, thigh: 12, torso };
  return (t) => {
    if (t <= 0.2) return between(DEADLIFT_SETUP, tipped, t / 0.2);
    if (t <= 0.45) return between(tipped, pastKnees, (t - 0.2) / 0.25);
    return between(pastKnees, DEADLIFT_LOCKOUT, (t - 0.45) / 0.55);
  };
}

describe('deadlift hips rising first', () => {
  it('passes a pull where the hips and shoulders rise together', () => {
    expect(hipsRiseFirst.evaluate(sideDeadliftRep())).toMatchObject({
      checkId: 'deadlift.hips-rise-first',
      status: 'pass',
      message: 'Hips and shoulders rose together off the floor.',
    });
  });

  it('warns when the torso tips forward on the way to the knees', () => {
    // From 55° at the set position to 75°.
    const result = hipsRiseFirst.evaluate(sideDeadliftRep(hipsFirst(75)));
    expect(result).toMatchObject({
      status: 'warn',
      message: 'Hips rose first: the torso tipped 20° further forward on the way to the knees.',
    });
  });

  it('fails a pull where the hips shoot up a long way first', () => {
    expect(hipsRiseFirst.evaluate(sideDeadliftRep(hipsFirst(82)))).toMatchObject({
      status: 'fail',
    });
  });

  it('counts hips that rise before the bar leaves the floor', () => {
    // The same pull, but set with the hips lower (torso at 45°) before they come up to the
    // usual 55° while the bar is still down. Measuring from liftoff would miss those 10°.
    const valueOf = (context: RepContext) => {
      const result = hipsRiseFirst.evaluate(context);
      return result.status === 'skipped' ? Number.NaN : (result.value ?? Number.NaN);
    };
    const lowHips = sideDeadliftFigure({ shin: 25, thigh: 75, torso: 45 });
    const setLow = sideDeadliftRep(hipsFirst(62), (landmarks, i) => (i < 5 ? lowHips : landmarks));
    expect(valueOf(setLow) - valueOf(sideDeadliftRep(hipsFirst(62)))).toBeCloseTo(10, 0);
  });

  it('skips a pull that starts with the bar above the knees', () => {
    const rackPull = sideDeadliftRep((t) =>
      between({ shin: 3, thigh: 10, torso: 35 }, DEADLIFT_LOCKOUT, t),
    );
    expect(hipsRiseFirst.evaluate(rackPull)).toMatchObject({ status: 'skipped' });
  });

  it('skips a rep where the hips are hidden at the floor', () => {
    const context = sideDeadliftRep(undefined, (landmarks, i) => {
      if (i < 20) setVisibility(landmarks, 'leftHip', 0);
      return landmarks;
    });
    expect(hipsRiseFirst.evaluate(context)).toMatchObject({ status: 'skipped' });
  });

  it('rarely flags a good pull when the points jitter', () => {
    const everyPoint = Object.keys(LANDMARK) as LandmarkName[];
    const random = seededRandom(1);
    const passes = Array.from({ length: 200 }, () => {
      const clean = sideDeadliftRep();
      const noisy = jitteredSequence(clean.sequence, everyPoint, 0.006, random);
      const context: RepContext = { ...clean, sequence: cleanPoses(noisy) };
      return hipsRiseFirst.evaluate(context).status;
    }).filter((status) => status === 'pass').length;
    expect(passes).toBeGreaterThanOrEqual(194);
  });
});
