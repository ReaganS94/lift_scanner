import { describe, expect, it } from 'vitest';
import type { BodyJoint } from '../../core';
import { isFocusSegment, jointOf } from './focus';

describe('jointOf', () => {
  it('drops the side', () => {
    expect(jointOf('leftKnee')).toBe('knee');
    expect(jointOf('rightShoulder')).toBe('shoulder');
  });

  it('gives null for points that are not joints', () => {
    expect(jointOf('nose')).toBeNull();
    expect(jointOf('leftFootIndex')).toBeNull();
  });
});

describe('isFocusSegment', () => {
  const depth = new Set<BodyJoint>(['hip', 'knee']);

  it('picks the thigh for a hip and knee check, on either side', () => {
    expect(isFocusSegment('leftHip', 'leftKnee', depth)).toBe(true);
    expect(isFocusSegment('rightHip', 'rightKnee', depth)).toBe(true);
  });

  it('leaves lines with only one focused end', () => {
    expect(isFocusSegment('leftKnee', 'leftAnkle', depth)).toBe(false);
    expect(isFocusSegment('leftAnkle', 'leftFootIndex', depth)).toBe(false);
  });
});
