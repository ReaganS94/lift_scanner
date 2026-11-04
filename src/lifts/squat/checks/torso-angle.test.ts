import { describe, expect, it } from 'vitest';
import { setVisibility } from '../../../testing/synthetic-pose';
import { sideSquatRep } from '../../../testing/squat-pose';
import { torsoAngle } from './torso-angle';

const PARALLEL = 0;

describe('squat torso angle', () => {
  it('passes an upright torso and points at the bottom', () => {
    const result = torsoAngle.evaluate(
      sideSquatRep({ thighBelowParallel: PARALLEL, torsoLean: 40 }),
    );
    expect(result).toMatchObject({
      checkId: 'squat.torso-angle',
      status: 'pass',
      message: 'Torso leaned 40° forward at the bottom.',
      frameIndex: 40,
    });
  });

  it('warns on a lean past 55°', () => {
    const result = torsoAngle.evaluate(
      sideSquatRep({ thighBelowParallel: PARALLEL, torsoLean: 60 }),
    );
    expect(result).toMatchObject({
      status: 'warn',
      message: 'Torso leaned 60° forward at the bottom, more than usual.',
    });
  });

  it('never fails a rep, however far it leans', () => {
    // Lean mostly reflects build and bar position, not technique.
    const result = torsoAngle.evaluate(
      sideSquatRep({ thighBelowParallel: PARALLEL, torsoLean: 75 }),
    );
    expect(result).toMatchObject({ status: 'warn' });
  });

  it('skips a rep where the shoulder is hidden at the bottom', () => {
    const clip = sideSquatRep({ thighBelowParallel: PARALLEL, torsoLean: 40 }, (landmarks, i) => {
      if (i >= 30 && i <= 50) setVisibility(landmarks, 'leftShoulder', 0);
      return landmarks;
    });
    expect(torsoAngle.evaluate(clip)).toMatchObject({ status: 'skipped' });
  });
});
