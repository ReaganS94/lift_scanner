import { describe, expect, it } from 'vitest';
import type { CheckStatus, RepContext } from '../../../core';
import { cleanPoses } from '../../../signal';
import { jittered, seededRandom } from '../../../testing/noise';
import { moved } from '../../../testing/synthetic-pose';
import { frontSquatRep } from '../../../testing/squat-pose';
import { kneesCaving } from './knees-caving';

/** Standing, the synthetic figure's knees and ankles are both 0.14 apart. */
const STANDING_GAP = 0.14;

describe('squat knees caving in', () => {
  it('passes knees that hold their width', () => {
    expect(kneesCaving.evaluate(frontSquatRep(STANDING_GAP))).toMatchObject({
      checkId: 'squat.knees-caving',
      status: 'pass',
      message: 'Knees held their width.',
    });
  });

  it('passes knees pushed out', () => {
    // Not exactly 0: standing width is a median over the first 0.2 s, as the knees start to move.
    expect(kneesCaving.evaluate(frontSquatRep(0.2))).toMatchObject({
      status: 'pass',
      value: expect.closeTo(0, 2) as number,
    });
  });

  it('warns when the knee gap narrows a little, and points at the narrowest moment', () => {
    const result = kneesCaving.evaluate(frontSquatRep(0.12));
    expect(result).toMatchObject({
      status: 'warn',
      message: 'Knees caved in: the gap between them narrowed by 14%.',
    });
    // The smoothed gap is level for a few frames at the bottom; the middle one is shown.
    expect(result).toMatchObject({ frameIndex: 40 });
  });

  it('fails knees that cave in clearly', () => {
    expect(kneesCaving.evaluate(frontSquatRep(0.09))).toMatchObject({ status: 'fail' });
  });

  it('compares with the lifter’s own standing width, so a narrow stance passes', () => {
    // Knees inside the ankles from the start, and they stay there.
    const narrowKnees = frontSquatRep(STANDING_GAP, (landmarks) =>
      moved(moved(landmarks, ['leftKnee'], -0.02, 0), ['rightKnee'], 0.02, 0),
    );
    expect(kneesCaving.evaluate(narrowKnees)).toMatchObject({ status: 'pass' });
  });

  it('skips a rep with the feet together', () => {
    const feetTogether = frontSquatRep(STANDING_GAP, (landmarks) =>
      moved(
        moved(landmarks, ['leftAnkle', 'leftKnee'], -0.06, 0),
        ['rightAnkle', 'rightKnee'],
        0.06,
        0,
      ),
    );
    expect(kneesCaving.evaluate(feetTogether)).toMatchObject({ status: 'skipped' });
  });

  describe('with landmark jitter, cleaned as the pipeline does', () => {
    const TRIALS = 200;
    /** About the jitter at which judging the single narrowest frame gave 1 in 4 false warnings. */
    const JITTER = 0.006;
    const LEG_POINTS = ['leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle'] as const;

    function statusesOf(bottomKneeGap: number): CheckStatus[] {
      const random = seededRandom(1);
      return Array.from({ length: TRIALS }, () => {
        const clean = frontSquatRep(bottomKneeGap);
        const frames = clean.sequence.frames.map((frame) => ({
          ...frame,
          landmarks: frame.landmarks && jittered(frame.landmarks, LEG_POINTS, JITTER, random),
        }));
        const context: RepContext = {
          ...clean,
          sequence: cleanPoses({ ...clean.sequence, frames }),
        };
        return kneesCaving.evaluate(context).status;
      });
    }

    it('rarely flags knees that hold their width', () => {
      const passes = statusesOf(STANDING_GAP).filter((status) => status === 'pass').length;
      expect(passes).toBeGreaterThanOrEqual(TRIALS * 0.97);
    });

    it('still flags knees that clearly cave in', () => {
      const flagged = statusesOf(0.1).filter((status) => status === 'fail' || status === 'warn');
      expect(flagged.length).toBeGreaterThanOrEqual(TRIALS * 0.97);
    });
  });
});
