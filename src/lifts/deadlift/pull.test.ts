import { describe, expect, it } from 'vitest';
import { sideDeadliftRep } from '../../testing/deadlift-pose';
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
    expect(lateStart?.floorHandsY).toBeCloseTo(onTime?.floorHandsY ?? 0);
  });

  it('finds where the hands reach the knees', () => {
    const pull = pullOf(sideDeadliftRep());
    expect(pull?.kneeHeight).toBeGreaterThan(pull?.liftoff ?? 0);
  });
});
