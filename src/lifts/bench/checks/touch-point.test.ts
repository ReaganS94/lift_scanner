import { describe, expect, it } from 'vitest';
import { LANDMARK, type LandmarkName, type RepContext } from '../../../core';
import { cleanPoses } from '../../../signal';
import {
  benchRep,
  BENCH_LOCKOUT,
  betweenHands,
  sideBenchFigure,
  sideBenchRep,
} from '../../../testing/bench-pose';
import { jitteredSequence, seededRandom } from '../../../testing/noise';
import { mirrored, setVisibility } from '../../../testing/synthetic-pose';
import { touchPoint } from './touch-point';

/** A rep touching `along` of the way from the shoulders to the hips. */
const touchingAt = (along: number) => sideBenchRep({ along, height: 0.06 });

describe('bench touch point', () => {
  it('passes a touch on the middle of the chest, at the bottom of the rep', () => {
    const result = touchPoint.evaluate(touchingAt(0.35));
    expect(result).toMatchObject({
      checkId: 'bench.touch-point',
      status: 'pass',
      message: 'The bar touched the middle of the chest.',
      value: expect.closeTo(0.35, 1) as number,
      frameIndex: 40,
    });
  });

  it('says which part of the chest the bar touched', () => {
    expect(touchPoint.evaluate(touchingAt(0.2))).toMatchObject({
      status: 'pass',
      message: 'The bar touched the upper chest.',
    });
    expect(touchPoint.evaluate(touchingAt(0.55))).toMatchObject({
      status: 'pass',
      message: 'The bar touched the lower chest.',
    });
  });

  it('warns about a touch near the collarbones', () => {
    expect(touchPoint.evaluate(touchingAt(0.1))).toMatchObject({
      status: 'warn',
      message: 'The bar touched high, near the collarbones.',
    });
  });

  it('only warns, never fails, however low the touch', () => {
    expect(touchPoint.evaluate(touchingAt(0.7))).toMatchObject({
      status: 'warn',
      message: 'The bar touched low, towards the stomach.',
    });
    expect(touchPoint.evaluate(touchingAt(1))).toMatchObject({ status: 'warn' });
  });

  it('measures the same with the head on the other side of the video', () => {
    const flipped: RepContext = benchRep('side', (t) =>
      mirrored(sideBenchFigure(betweenHands(BENCH_LOCKOUT, { along: 0.1, height: 0.06 }, t))),
    );
    expect(touchPoint.evaluate(flipped)).toMatchObject({
      status: 'warn',
      value: expect.closeTo(0.1, 1) as number,
    });
  });

  it('skips a rep where the wrist is hidden at the bottom', () => {
    const context = sideBenchRep();
    const frames = context.sequence.frames.map((frame, index) => {
      if (!frame.landmarks || Math.abs(index - 40) > 5) return frame;
      const landmarks = [...frame.landmarks];
      setVisibility(landmarks, 'leftWrist', 0);
      return { ...frame, landmarks };
    });
    const hidden = { ...context, sequence: { ...context.sequence, frames } };
    expect(touchPoint.evaluate(hidden)).toMatchObject({ status: 'skipped' });
  });

  it('is steady when the points jitter', () => {
    const everyPoint = Object.keys(LANDMARK) as LandmarkName[];
    const random = seededRandom(1);
    const statuses = (along: number) =>
      Array.from({ length: 200 }, () => {
        const clean = touchingAt(along);
        const noisy = jitteredSequence(clean.sequence, everyPoint, 0.006, random);
        return touchPoint.evaluate({ ...clean, sequence: cleanPoses(noisy) }).status;
      });
    expect(statuses(0.35).filter((status) => status !== 'pass')).toEqual([]);
    expect(statuses(0.1).filter((status) => status !== 'warn')).toEqual([]);
  });
});
