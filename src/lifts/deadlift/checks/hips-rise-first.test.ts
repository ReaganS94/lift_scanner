import { describe, expect, it } from 'vitest';
import { LANDMARK, type Landmark, type LandmarkName, type RepContext } from '../../../core';
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
    // From 55° at the set position to 75°. The first 4° happen before the bar is off the
    // floor, and only the tipping after liftoff is judged.
    const result = hipsRiseFirst.evaluate(sideDeadliftRep(hipsFirst(75)));
    expect(result).toMatchObject({
      status: 'warn',
      message: 'Hips rose first: the torso tipped 16° further forward on the way to the knees.',
    });
  });

  it('fails a pull where the hips shoot up a long way first', () => {
    expect(hipsRiseFirst.evaluate(sideDeadliftRep(hipsFirst(82)))).toMatchObject({
      status: 'fail',
    });
  });

  describe('a dip-and-rip setup: hips low, then rising into position before the pull', () => {
    // Frames 0 to 4 have the hips low (torso at 35°), frames 5 to 9 rise into the usual set
    // position, and the pull starts at frame 10. The hands stay on the bar on the floor.
    const lowHips = sideDeadliftFigure({ shin: 25, thigh: 85, torso: 35 });
    const handsOnBar = sideDeadliftFigure(DEADLIFT_SETUP);
    function withDip(path?: (t: number) => DeadliftPosition): RepContext {
      return sideDeadliftRep(path, (landmarks, i) => {
        if (i >= 10) return landmarks;
        const dipped = i < 5 ? lowHips : mixFigures(lowHips, landmarks, (i - 4) / 5);
        return withHandsFrom(dipped, handsOnBar);
      });
    }

    it('passes a good pull: rising into the set position is not a fault', () => {
      expect(hipsRiseFirst.evaluate(withDip())).toMatchObject({ status: 'pass' });
    });

    it('still flags hips that shoot up once the bar is moving', () => {
      expect(hipsRiseFirst.evaluate(withDip(hipsFirst(75)))).toMatchObject({ status: 'warn' });
    });
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

  describe('with the hands hidden behind the plates, following the shoulders', () => {
    const hidden = (path?: (t: number) => DeadliftPosition) =>
      sideDeadliftRep(path, (landmarks) => {
        setVisibility(landmarks, 'leftWrist', 0);
        setVisibility(landmarks, 'rightWrist', 0);
        return landmarks;
      });

    it('passes a good pull', () => {
      expect(hipsRiseFirst.evaluate(hidden())).toMatchObject({ status: 'pass' });
    });

    it('flags hips shooting up, if a little more leniently than with the hands', () => {
      // 16° with the hands too: the tipping happens after the shoulders start to rise.
      expect(hipsRiseFirst.evaluate(hidden(hipsFirst(75)))).toMatchObject({
        status: 'warn',
        value: expect.closeTo(16, 0) as number,
      });
      // 21° with the hands. The shoulders barely rise while the hips shoot up, so liftoff is
      // found a frame late and some of the early tipping is missed.
      expect(hipsRiseFirst.evaluate(hidden(hipsFirst(82)))).toMatchObject({ status: 'warn' });
    });

    it('rarely flags a good pull when the points jitter', () => {
      const everyPoint = Object.keys(LANDMARK) as LandmarkName[];
      const random = seededRandom(2);
      const passes = Array.from({ length: 200 }, () => {
        const clean = hidden();
        const noisy = jitteredSequence(clean.sequence, everyPoint, 0.006, random);
        const context: RepContext = { ...clean, sequence: cleanPoses(noisy) };
        return hipsRiseFirst.evaluate(context).status;
      }).filter((status) => status === 'pass').length;
      expect(passes).toBeGreaterThanOrEqual(194);
    });

    it('skips a pull that starts with the bar above the knees', () => {
      const rackPull = hidden((t) =>
        between({ shin: 3, thigh: 10, torso: 35 }, DEADLIFT_LOCKOUT, t),
      );
      expect(hipsRiseFirst.evaluate(rackPull)).toMatchObject({ status: 'skipped' });
    });
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

/** Each point a fraction `t` of the way from `from` to `to`. */
function mixFigures(from: readonly Landmark[], to: readonly Landmark[], t: number): Landmark[] {
  return from.map((point, i) => {
    const target = to[i] ?? point;
    return {
      ...point,
      x: point.x + (target.x - point.x) * t,
      y: point.y + (target.y - point.y) * t,
    };
  });
}

/** A copy of `figure` with the wrists where they are in `source`. */
function withHandsFrom(figure: readonly Landmark[], source: readonly Landmark[]): Landmark[] {
  const result = [...figure];
  for (const name of ['leftWrist', 'rightWrist'] as const) {
    const hand = source[LANDMARK[name]];
    if (hand) result[LANDMARK[name]] = hand;
  }
  return result;
}
