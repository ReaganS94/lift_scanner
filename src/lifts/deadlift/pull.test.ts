import { describe, expect, it } from 'vitest';
import { LANDMARK, type Landmark } from '../../core';
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

  it('finds the knees from the knee point when the hands and knees are seen', () => {
    // Knees set higher than usual (long shins), so the hands pass them well over a third of
    // the way up: a third of the rise would end the early pull too soon.
    const longShins = sideDeadliftRep(undefined, (landmarks) => {
      for (const name of ['leftKnee', 'rightKnee'] as const) {
        const knee = landmarks[LANDMARK[name]];
        if (knee) landmarks[LANDMARK[name]] = { ...knee, y: knee.y - 0.04 };
      }
      return landmarks;
    });
    const pull = pullOf(longShins);
    const handAboveKnee = (position: number) => {
      const landmarks = pull?.frames[position]?.frame.landmarks;
      const wrist = landmarks?.[LANDMARK.leftWrist];
      const knee = landmarks?.[LANDMARK.leftKnee];
      return wrist !== undefined && knee !== undefined && wrist.y <= knee.y;
    };
    const at = pull?.kneeHeight ?? -1;
    expect(handAboveKnee(at)).toBe(true);
    expect(handAboveKnee(at - 1)).toBe(false);
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

    describe('and the plate followed', () => {
      /** The plate's centre where the hands would be, as the bar tracker reports it. */
      const withPlate = () => {
        const context = hidden();
        const barTrack = sideDeadliftRep().sequence.frames.map((frame) => {
          const wrist = frame.landmarks?.[LANDMARK.leftWrist];
          return wrist ? { x: wrist.x, y: wrist.y, radius: 0.11, confidence: 0.9 } : null;
        });
        return { ...context, sequence: { ...context.sequence, barTrack } };
      };

      it('follows the bar with the plate', () => {
        expect(pullOf(withPlate())?.tracker).toBe('plate');
      });

      it('finds the same floor, liftoff and knee height as the hands would', () => {
        const fromPlate = pullOf(withPlate());
        const fromHands = pullOf(sideDeadliftRep());
        expect(fromPlate?.frames[0]?.index).toBe(fromHands?.frames[0]?.index);
        expect(fromPlate?.kneeHeight).toBe(fromHands?.kneeHeight);
        expect(fromPlate?.facing).toBe(1);
      });
    });
  });
});

function withHandsHidden(landmarks: Landmark[]): Landmark[] {
  setVisibility(landmarks, 'leftWrist', 0);
  setVisibility(landmarks, 'rightWrist', 0);
  return landmarks;
}
