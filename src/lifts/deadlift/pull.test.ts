import { describe, expect, it } from 'vitest';
import type { Landmark } from '../../core';
import { sideDeadliftRep } from '../../testing/deadlift-pose';
import { setVisibility } from '../../testing/synthetic-pose';
import { pullOf } from './pull';

describe('pullOf', () => {
  it('finds the lifter facing the way the hands are from the hips at the floor', () => {
    expect(pullOf(sideDeadliftRep())?.facing).toBe(1);
  });

  it('starts at the true floor when the rep starts a little way off it', () => {
    // Rep detection ends rest within 0.1 torso lengths of it, so a deadlift rep can start
    // with the bar already slightly up. The pull should still start on the floor.
    const onTime = pullOf(sideDeadliftRep());
    const late = sideDeadliftRep();
    const lateStart = pullOf({ ...late, rep: { ...late.rep, startFrame: 16 } });
    expect(lateStart?.frames[0]?.index).toBe(onTime?.frames[0]?.index);
    expect(lateStart?.floorY).toBeCloseTo(onTime?.floorY ?? 0);
  });

  it('finds where the hands reach the knees', () => {
    const pull = pullOf(sideDeadliftRep());
    expect(pull?.kneeHeight).toBeGreaterThan(pull?.liftoff ?? 0);
  });

  it('follows the bar with the hands when they are seen', () => {
    expect(pullOf(sideDeadliftRep())?.tracker).toBe('hands');
  });

  describe('with the hands hidden behind the plates', () => {
    const hidden = () => sideDeadliftRep(undefined, withHandsHidden);

    it('follows the bar with the shoulders instead', () => {
      expect(pullOf(hidden())?.tracker).toBe('shoulders');
    });

    it('finds the same floor frame and the lifter facing the same way', () => {
      const pull = pullOf(hidden());
      expect(pull?.frames[0]?.index).toBe(pullOf(sideDeadliftRep())?.frames[0]?.index);
      expect(pull?.facing).toBe(1);
    });

    it('finds where the bar reaches the knees', () => {
      const pull = pullOf(hidden());
      expect(pull?.kneeHeight).toBeGreaterThan(pull?.liftoff ?? 0);
    });
  });
});

function withHandsHidden(landmarks: Landmark[]): Landmark[] {
  setVisibility(landmarks, 'leftWrist', 0);
  setVisibility(landmarks, 'rightWrist', 0);
  return landmarks;
}
