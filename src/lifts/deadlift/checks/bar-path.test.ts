import { describe, expect, it } from 'vitest';
import { LANDMARK, type BarPoint, type LandmarkName, type RepContext } from '../../../core';
import { cleanPoses } from '../../../signal';
import {
  between,
  DEADLIFT_LOCKOUT,
  DEADLIFT_SETUP,
  sideDeadliftRep,
} from '../../../testing/deadlift-pose';
import { jitteredSequence, seededRandom } from '../../../testing/noise';
import { setVisibility } from '../../../testing/synthetic-pose';
import { barPath } from './bar-path';

/** A pull where the bar swings forward by up to `peak` frame heights mid-pull and back. */
function swinging(peak: number) {
  return sideDeadliftRep((t) => ({
    ...between(DEADLIFT_SETUP, DEADLIFT_LOCKOUT, t),
    barAhead: peak * Math.sin(Math.PI * t),
  }));
}

describe('deadlift bar path', () => {
  it('passes a bar that stays over the middle of the foot', () => {
    expect(barPath.evaluate(sideDeadliftRep())).toMatchObject({
      checkId: 'deadlift.bar-path',
      status: 'pass',
      message: 'The bar stayed close to the legs.',
    });
  });

  it('warns when the bar drifts a little forward, and points at the furthest moment', () => {
    // 0.04 frame heights is 0.16 torso lengths; a little of it has happened by liftoff.
    const result = barPath.evaluate(swinging(0.04));
    expect(result).toMatchObject({
      status: 'warn',
      message: 'The bar drifted forward during the pull, by about 13% of your torso length.',
    });
    // The middle of the furthest stretch, which the steadying median widens by a frame.
    expect(result.status !== 'skipped' && result.frameIndex).toBe(24);
  });

  it('fails a bar that swings well away from the legs', () => {
    expect(barPath.evaluate(swinging(0.08))).toMatchObject({ status: 'fail' });
  });

  it('passes a bar that moves back towards the body', () => {
    expect(barPath.evaluate(swinging(-0.04))).toMatchObject({ status: 'pass' });
  });

  it('skips a rep where the hands are hidden at the floor', () => {
    const context = sideDeadliftRep(undefined, (landmarks, i) => {
      if (i < 20) {
        setVisibility(landmarks, 'leftWrist', 0);
        setVisibility(landmarks, 'rightWrist', 0);
      }
      return landmarks;
    });
    expect(barPath.evaluate(context)).toMatchObject({ status: 'skipped' });
  });

  it('rarely flags a straight bar path when the points jitter', () => {
    const everyPoint = Object.keys(LANDMARK) as LandmarkName[];
    const random = seededRandom(1);
    const passes = Array.from({ length: 200 }, () => {
      const clean = sideDeadliftRep();
      const noisy = jitteredSequence(clean.sequence, everyPoint, 0.006, random);
      return barPath.evaluate({ ...clean, sequence: cleanPoses(noisy) }).status;
    }).filter((status) => status === 'pass').length;
    expect(passes).toBeGreaterThanOrEqual(194);
  });

  describe('following the plate', () => {
    /**
     * A rep with the hands hidden by the plate, as from the side, and the plate followed at the
     * hands' true position plus `edit`.
     */
    function withPlate(
      context: RepContext,
      edit: (point: BarPoint, frameIndex: number) => BarPoint | null = (point) => point,
    ): RepContext {
      const barTrack = context.sequence.frames.map((frame, i) => {
        const wrist = frame.landmarks?.[LANDMARK.leftWrist];
        return wrist ? edit({ x: wrist.x, y: wrist.y, radius: 0.11, confidence: 0.9 }, i) : null;
      });
      const frames = context.sequence.frames.map((frame) => ({
        ...frame,
        landmarks:
          frame.landmarks?.map((landmark, i) =>
            i === LANDMARK.leftWrist || i === LANDMARK.rightWrist
              ? { ...landmark, visibility: 0 }
              : landmark,
          ) ?? null,
      }));
      return { ...context, sequence: { ...context.sequence, frames, barTrack } };
    }

    it('measures the bar path from the plate when the hands are hidden', () => {
      expect(barPath.evaluate(withPlate(sideDeadliftRep()))).toMatchObject({ status: 'pass' });
      expect(barPath.evaluate(withPlate(swinging(0.08)))).toMatchObject({ status: 'fail' });
    });

    it('trusts the plate over the hands when both are seen', () => {
      const context = withPlate(sideDeadliftRep(), (point, i) => ({
        ...point,
        // The plate drifts 0.1 frame heights (0.4 torso lengths) forward after liftoff.
        x: point.x + 0.1 * Math.min(1, Math.max(0, (i - 15) / 10)),
      }));
      const { barTrack = [] } = context.sequence;
      const handsSeen = { ...context, sequence: { ...sideDeadliftRep().sequence, barTrack } };
      expect(barPath.evaluate(handsSeen)).toMatchObject({ status: 'fail' });
    });

    it("isn't failed by one frame where the plate was placed wrongly", () => {
      const context = withPlate(sideDeadliftRep(), (point, i) =>
        i === 25 ? { ...point, x: point.x + 0.1 } : point,
      );
      expect(barPath.evaluate(context)).toMatchObject({ status: 'pass' });
    });

    it('skips when neither the plate nor the hands were followed', () => {
      const context = withPlate(sideDeadliftRep(), () => null);
      expect(barPath.evaluate(context)).toMatchObject({ status: 'skipped' });
    });
  });
});
