import { describe, expect, it } from 'vitest';
import type { LandmarkName } from '../../../../core';
import { bothSides, photoPose, towards, type Point } from '../../../../testing/photo-pose';
import { armsStraight } from './arms-straight';
import { hipHeight } from './hip-height';
import { shouldersOverBar } from './shoulders-over-bar';

const HIP: Point = { x: 0.2, y: 0.55 };
const KNEE: Point = { x: 0.3, y: 0.68 };

interface Setup {
  /** Torso lean from vertical, in degrees: 90 is flat. */
  readonly lean?: number;
  readonly hip?: Point;
  /** Arm tilt forward from straight down, in degrees. */
  readonly armTilt?: number;
  /** Elbow bend, in degrees. */
  readonly elbowBend?: number;
  readonly hidden?: LandmarkName[];
}

/** A side-on setup photo, facing right. */
function setup({ lean = 60, hip = HIP, armTilt = 0, elbowBend = 0, hidden = [] }: Setup = {}) {
  const shoulder = towards(hip, lean, 0.25);
  const elbow = towards(shoulder, 180 - armTilt, 0.14);
  const wrist = towards(elbow, 180 - armTilt + elbowBend, 0.13);
  return photoPose(
    {
      ...bothSides('Hip', hip),
      ...bothSides('Knee', KNEE),
      ...bothSides('Shoulder', shoulder),
      ...bothSides('Elbow', elbow),
      ...bothSides('Wrist', wrist),
    },
    { hidden },
  );
}

describe('deadlift setup photo: hip height', () => {
  it('passes hips between the knees and shoulders', () => {
    expect(hipHeight.evaluate(setup())).toMatchObject({ status: 'pass', frameIndex: 0 });
  });

  it('fails hips below the knees', () => {
    expect(hipHeight.evaluate(setup({ hip: { x: 0.2, y: 0.7 } }))).toMatchObject({
      status: 'fail',
    });
  });

  it('warns hips close to shoulder height', () => {
    expect(hipHeight.evaluate(setup({ lean: 85, hip: { x: 0.2, y: 0.45 } }))).toMatchObject({
      status: 'warn',
      message: 'Hips are close to shoulder height, a stiff-legged start.',
    });
  });

  it('skips a photo where the plate hides the knee', () => {
    expect(hipHeight.evaluate(setup({ hidden: ['leftKnee'] }))).toMatchObject({
      status: 'skipped',
    });
  });
});

describe('deadlift setup photo: shoulders over the bar', () => {
  it('passes arms hanging straight down or tilted a little back', () => {
    expect(shouldersOverBar.evaluate(setup())).toMatchObject({
      status: 'pass',
      message: 'Shoulders are over the bar.',
    });
    expect(shouldersOverBar.evaluate(setup({ armTilt: -12 }))).toMatchObject({
      status: 'pass',
      message: 'Shoulders are just ahead of the bar.',
    });
  });

  it('warns when the arms tilt forward, with the shoulders behind the bar', () => {
    expect(shouldersOverBar.evaluate(setup({ armTilt: 15 }))).toMatchObject({
      status: 'warn',
      value: expect.closeTo(15, 5) as number,
    });
  });

  it('measures along the upper arm when the plate hides the hand', () => {
    expect(shouldersOverBar.evaluate(setup({ armTilt: 15, hidden: ['leftWrist'] }))).toMatchObject({
      status: 'warn',
    });
  });

  it('warns shoulders far ahead of the bar', () => {
    expect(shouldersOverBar.evaluate(setup({ armTilt: -35 }))).toMatchObject({ status: 'warn' });
  });
});

describe('deadlift setup photo: straight arms', () => {
  it('passes straight arms and warns bent ones', () => {
    expect(armsStraight.evaluate(setup())).toMatchObject({ status: 'pass' });
    expect(armsStraight.evaluate(setup({ elbowBend: 30 }))).toMatchObject({
      status: 'warn',
      message: 'Elbows are bent 30°. Pull the slack out with straight arms.',
    });
  });

  it('skips when the hand is hidden', () => {
    expect(armsStraight.evaluate(setup({ hidden: ['leftWrist'] }))).toMatchObject({
      status: 'skipped',
    });
  });
});
