import { describe, expect, it } from 'vitest';
import { angleFromVertical, forwardTilt, jointAngle } from './angles';

describe('jointAngle', () => {
  it('is 180 for a straight line', () => {
    expect(jointAngle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 })).toBeCloseTo(180);
  });

  it('is 90 for a right angle', () => {
    expect(jointAngle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBeCloseTo(90);
  });

  it('is 45 for a half right angle', () => {
    expect(jointAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(45);
  });

  it('returns null when a segment has no length', () => {
    expect(jointAngle({ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 2 })).toBeNull();
  });
});

describe('angleFromVertical', () => {
  const hip = { x: 0.5, y: 0.5 };

  it('is 0 when the segment points straight up the image', () => {
    expect(angleFromVertical(hip, { x: 0.5, y: 0.2 })).toBeCloseTo(0);
  });

  it('is 90 when the segment is level', () => {
    expect(angleFromVertical(hip, { x: 0.8, y: 0.5 })).toBeCloseTo(90);
  });

  it('is 45 for a forward lean of 45 degrees, in either direction', () => {
    expect(angleFromVertical(hip, { x: 0.7, y: 0.3 })).toBeCloseTo(45);
    expect(angleFromVertical(hip, { x: 0.3, y: 0.3 })).toBeCloseTo(45);
  });

  it('returns null when both points are the same', () => {
    expect(angleFromVertical(hip, hip)).toBeNull();
  });
});

describe('forwardTilt', () => {
  const hip = { x: 0.5, y: 0.5 };

  it('is positive when the end point is ahead of the lifter, negative when behind', () => {
    expect(forwardTilt(hip, { x: 0.6, y: 0.4 }, 1)).toBeCloseTo(45);
    expect(forwardTilt(hip, { x: 0.4, y: 0.4 }, 1)).toBeCloseTo(-45);
    // The same points for a lifter facing the other way.
    expect(forwardTilt(hip, { x: 0.6, y: 0.4 }, -1)).toBeCloseTo(-45);
  });

  it('measures a segment pointing down from straight down', () => {
    // A thigh from hip to a knee slightly ahead and below.
    expect(forwardTilt(hip, { x: 0.5 + 0.1 * Math.tan(Math.PI / 12), y: 0.6 }, 1)).toBeCloseTo(15);
  });

  it('is 0 for a vertical segment and null when the segment has no length', () => {
    expect(forwardTilt(hip, { x: 0.5, y: 0.2 }, 1)).toBeCloseTo(0);
    expect(forwardTilt(hip, hip, 1)).toBeNull();
  });
});
