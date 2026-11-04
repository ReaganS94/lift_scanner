import { describe, expect, it } from 'vitest';
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

  it('warns when the knee gap narrows a little, and points at the narrowest frame', () => {
    expect(kneesCaving.evaluate(frontSquatRep(0.12))).toMatchObject({
      status: 'warn',
      message: 'Knees caved in: the gap between them narrowed by 14%.',
      frameIndex: 40,
    });
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
});
