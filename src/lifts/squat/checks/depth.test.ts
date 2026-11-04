import { describe, expect, it } from 'vitest';
import { setVisibility } from '../../../testing/synthetic-pose';
import { sideSquatRep } from '../../../testing/squat-pose';
import { depth } from './depth';

const TORSO_LEAN = 40;

describe('squat depth', () => {
  it('passes a rep below parallel and points at the bottom', () => {
    expect(depth.evaluate(sideSquatRep({ thighBelowParallel: 10, torsoLean: TORSO_LEAN }))).toEqual(
      {
        checkId: 'squat.depth',
        status: 'pass',
        message: 'Hips went 10° below parallel.',
        value: expect.closeTo(10, 5) as number,
        frameIndex: 40,
      },
    );
  });

  it('passes a rep that just reaches parallel', () => {
    const result = depth.evaluate(sideSquatRep({ thighBelowParallel: 0, torsoLean: TORSO_LEAN }));
    expect(result).toMatchObject({ status: 'pass', message: 'Hips reached parallel.' });
  });

  it('warns on a rep a little above parallel', () => {
    const result = depth.evaluate(sideSquatRep({ thighBelowParallel: -5, torsoLean: TORSO_LEAN }));
    expect(result).toMatchObject({ status: 'warn', message: 'Hips stopped 5° above parallel.' });
  });

  it('fails a clearly shallow rep', () => {
    const result = depth.evaluate(sideSquatRep({ thighBelowParallel: -25, torsoLean: TORSO_LEAN }));
    expect(result).toMatchObject({ status: 'fail', message: 'Hips stopped 25° above parallel.' });
  });

  it('ignores the far side of the body', () => {
    const clip = sideSquatRep({ thighBelowParallel: 10, torsoLean: TORSO_LEAN }, (landmarks) => {
      setVisibility(landmarks, 'rightKnee', 0);
      setVisibility(landmarks, 'rightHip', 0);
      return landmarks;
    });
    expect(depth.evaluate(clip)).toMatchObject({ status: 'pass' });
  });

  it('skips a rep where the knee is hidden at the bottom', () => {
    // Judging from the frames either side would make the rep look shallower than it was.
    const clip = sideSquatRep({ thighBelowParallel: 10, torsoLean: TORSO_LEAN }, (landmarks, i) => {
      if (i >= 30 && i <= 50) setVisibility(landmarks, 'leftKnee', 0);
      return landmarks;
    });
    expect(depth.evaluate(clip)).toMatchObject({ status: 'skipped' });
  });
});
