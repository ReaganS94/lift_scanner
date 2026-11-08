import { describe, expect, it } from 'vitest';
import type { LandmarkName } from '../../../../core';
import { bothSides, photoPose, towards, type Point } from '../../../../testing/photo-pose';
import { lockoutPhoto } from './lockout';

const HIP: Point = { x: 0.28, y: 0.5 };

/** A side-on photo at the top, facing right (the nose is ahead of the ear). */
function top(hipBend: number, kneeBend: number, hidden: LandmarkName[] = []) {
  const knee = towards(HIP, 180, 0.19);
  const ankle = towards(knee, 180 + kneeBend, 0.2);
  const shoulder = towards(HIP, hipBend, 0.25);
  return photoPose(
    {
      ...bothSides('Hip', HIP),
      ...bothSides('Knee', knee),
      ...bothSides('Ankle', ankle),
      ...bothSides('Shoulder', shoulder),
      leftEar: { x: shoulder.x, y: 0.15 },
      nose: { x: shoulder.x + 0.04, y: 0.16 },
    },
    { hidden },
  );
}

describe('deadlift lockout photo', () => {
  it('passes straight hips and knees, and leaning back', () => {
    expect(lockoutPhoto.evaluate(top(3, 2))).toMatchObject({
      status: 'pass',
      message: 'Hips and knees locked out.',
      frameIndex: 0,
    });
    expect(lockoutPhoto.evaluate(top(-8, 0))).toMatchObject({ status: 'pass' });
  });

  it('fails hips well short of locked out, like the video check', () => {
    expect(lockoutPhoto.evaluate(top(25, 0))).toMatchObject({
      status: 'fail',
      message: 'Hips stayed 25° short of locked out.',
    });
  });

  it('checks only the hips when the knee is hidden', () => {
    expect(lockoutPhoto.evaluate(top(3, 0, ['leftKnee']))).toMatchObject({
      status: 'pass',
      message: 'Hips locked out. Your knees weren’t seen clearly, so only the hips were checked.',
    });
  });

  it('skips when it can’t tell which way the lifter faces', () => {
    expect(lockoutPhoto.evaluate(top(3, 0, ['nose', 'leftEar']))).toMatchObject({
      status: 'skipped',
    });
  });
});
