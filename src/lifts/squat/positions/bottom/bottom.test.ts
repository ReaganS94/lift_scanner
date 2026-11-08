import { describe, expect, it } from 'vitest';
import type { LandmarkName } from '../../../../core';
import { bothSides, photoPose, towards, type Point } from '../../../../testing/photo-pose';
import { bottomDepth } from './depth';
import { kneesOverFeet } from './knees-over-feet';
import { bottomTorsoAngle } from './torso-angle';

const HIP: Point = { x: 0.25, y: 0.62 };

/** A side-on photo of the bottom, facing right, with the thigh and torso at the given angles. */
function bottom(thighBelowParallel: number, torsoLean: number, hidden: LandmarkName[] = []) {
  // The knee is ahead of the hip: straight ahead at parallel, higher when the hip is lower.
  const knee = towards(HIP, 90 - thighBelowParallel, 0.2);
  return photoPose(
    {
      ...bothSides('Hip', HIP),
      ...bothSides('Knee', knee),
      ...bothSides('Shoulder', towards(HIP, torsoLean, 0.25)),
    },
    { hidden },
  );
}

describe('squat bottom photo: depth', () => {
  it('passes a photo below parallel, pointing at the photo', () => {
    expect(bottomDepth.evaluate(bottom(8, 40))).toEqual({
      checkId: 'squat.bottom.depth',
      status: 'pass',
      message: 'Hips went 8° below parallel.',
      value: expect.closeTo(8, 5) as number,
      frameIndex: 0,
    });
  });

  it('warns a little above parallel and fails well above it, like the video check', () => {
    expect(bottomDepth.evaluate(bottom(-6, 40))).toMatchObject({ status: 'warn' });
    expect(bottomDepth.evaluate(bottom(-20, 40))).toMatchObject({
      status: 'fail',
      message: 'Hips stopped 20° above parallel.',
    });
  });

  it('skips a photo where the near knee is hidden', () => {
    expect(bottomDepth.evaluate(bottom(8, 40, ['leftKnee']))).toMatchObject({
      status: 'skipped',
    });
  });
});

describe('squat bottom photo: torso angle', () => {
  it('passes a usual lean and warns past 55°', () => {
    expect(bottomTorsoAngle.evaluate(bottom(5, 40))).toMatchObject({
      status: 'pass',
      message: 'Torso leaned 40° forward at the bottom.',
    });
    expect(bottomTorsoAngle.evaluate(bottom(5, 62))).toMatchObject({ status: 'warn' });
  });
});

describe('squat bottom photo: knees over feet', () => {
  /** A front photo with the ankles 0.2 apart and each knee at the given distance out. */
  function front(leftKneeOut: number, rightKneeOut: number) {
    const centre = 0.28;
    return photoPose(
      {
        leftAnkle: { x: centre + 0.1, y: 0.9 },
        rightAnkle: { x: centre - 0.1, y: 0.9 },
        leftKnee: { x: centre + leftKneeOut, y: 0.72 },
        rightKnee: { x: centre - rightKneeOut, y: 0.72 },
        leftHip: { x: centre + 0.07, y: 0.68 },
        rightHip: { x: centre - 0.07, y: 0.68 },
        leftShoulder: { x: centre + 0.1, y: 0.45 },
        rightShoulder: { x: centre - 0.1, y: 0.45 },
      },
      { view: 'front' },
    );
  }

  it('passes knees pushed out past the feet', () => {
    expect(kneesOverFeet.evaluate(front(0.12, 0.13))).toMatchObject({
      status: 'pass',
      message: 'Both knees are pushed out over or past the feet.',
      frameIndex: 0,
    });
  });

  it('passes knees a little inside the feet, within the model’s wobble', () => {
    expect(kneesOverFeet.evaluate(front(0.095, 0.092))).toMatchObject({ status: 'pass' });
  });

  it('names the one knee caving in by its side of the photo', () => {
    // The lifter's right knee, which a front photo shows on its left.
    expect(kneesOverFeet.evaluate(front(0.12, 0.08))).toMatchObject({
      status: 'warn',
      message: 'The knee on the left of the photo is inside its foot: it’s caving in.',
    });
  });

  it('fails both knees well inside the feet', () => {
    expect(kneesOverFeet.evaluate(front(0.05, 0.06))).toMatchObject({
      status: 'fail',
      message: 'Both knees are inside the feet: they’re caving in.',
    });
  });

  it('skips feet too close together to judge', () => {
    const centre = 0.28;
    const narrow = photoPose(
      {
        leftAnkle: { x: centre + 0.01, y: 0.9 },
        rightAnkle: { x: centre - 0.01, y: 0.9 },
      },
      { view: 'front' },
    );
    expect(kneesOverFeet.evaluate(narrow)).toMatchObject({ status: 'skipped' });
  });
});
