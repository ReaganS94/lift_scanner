import { describe, expect, it } from 'vitest';
import { LANDMARK, type LandmarkName, type RepContext } from '../../../core';
import { cleanPoses } from '../../../signal';
import {
  BENCH_TORSO,
  BENCH_TOUCH,
  betweenHands,
  sideBenchFigure,
  sideBenchRep,
} from '../../../testing/bench-pose';
import { jitteredSequence, seededRandom } from '../../../testing/noise';
import { repWave, sequenceOf, setVisibility } from '../../../testing/synthetic-pose';
import { lockout } from './lockout';

/**
 * A rep that stops `height` above the shoulders at the top. A straight arm reaches 0.3; the
 * elbow bend grows fast just short of that, so 0.295 is about 21° bent.
 */
const toppingOutAt = (height: number) => sideBenchRep(BENCH_TOUCH, { along: 0, height });

/**
 * Two reps back to back with no pause at the top, judging the first: the arms are straight
 * for a single frame, at frame 70, before the next rep starts down.
 */
function touchAndGo(): RepContext {
  const rest = (): number[] => Array.from({ length: 10 }, () => 0);
  const wave = [
    ...rest(),
    ...repWave({ reps: 2, repFrames: 60, restFrames: 0, amplitude: 1 }),
    ...rest(),
  ];
  const top = { along: 0, height: 0.3 };
  return {
    sequence: sequenceOf(wave.map((t) => sideBenchFigure(betweenHands(top, BENCH_TOUCH, t)))),
    view: 'side',
    torsoLength: BENCH_TORSO,
    nearSide: 'left',
    rep: { index: 0, startFrame: 9, turnFrame: 40, endFrame: 70 },
  };
}

describe('bench lockout', () => {
  it('passes straight arms, and points at the middle of the time locked out', () => {
    // Locked out from the end of the rep at frame 70 to the end of the clip at frame 79.
    expect(lockout.evaluate(sideBenchRep())).toMatchObject({
      checkId: 'bench.lockout',
      status: 'pass',
      message: 'Elbows locked out at the top.',
      value: 0,
      frameIndex: 75,
    });
  });

  it('warns when the elbows stay a little bent', () => {
    expect(lockout.evaluate(toppingOutAt(0.295))).toMatchObject({
      status: 'warn',
      message: 'Elbows stayed 21° bent at the top.',
    });
  });

  it('fails elbows that stay clearly bent', () => {
    expect(lockout.evaluate(toppingOutAt(0.285))).toMatchObject({
      status: 'fail',
      message: 'Elbows stayed 36° bent at the top.',
    });
  });

  it('passes a touch-and-go rep whose arms are straight for only a moment', () => {
    // The smoothing reads the frames either side of the lockout, about 8° bent.
    expect(lockout.evaluate(touchAndGo())).toMatchObject({ status: 'pass', frameIndex: 70 });
  });

  it('skips a rep where the elbow is hidden at the top', () => {
    const context = sideBenchRep();
    const frames = context.sequence.frames.map((frame, index) => {
      if (!frame.landmarks || index < 55) return frame;
      const landmarks = [...frame.landmarks];
      setVisibility(landmarks, 'leftElbow', 0);
      return { ...frame, landmarks };
    });
    const hidden = { ...context, sequence: { ...context.sequence, frames } };
    expect(lockout.evaluate(hidden)).toMatchObject({ status: 'skipped' });
  });

  describe('with landmark jitter, cleaned as the pipeline does', () => {
    const everyPoint = Object.keys(LANDMARK) as LandmarkName[];

    function statusesOf(make: () => RepContext) {
      const random = seededRandom(1);
      return Array.from({ length: 200 }, () => {
        const clean = make();
        const noisy = jitteredSequence(clean.sequence, everyPoint, 0.006, random);
        return lockout.evaluate({ ...clean, sequence: cleanPoses(noisy) }).status;
      });
    }

    it('passes a held lockout', () => {
      expect(statusesOf(sideBenchRep).filter((status) => status !== 'pass')).toEqual([]);
    });

    it('rarely flags a touch-and-go lockout', () => {
      // 198 of 200 pass. A 0.25 s smoothing window, as the knee check uses, passed 58.
      const passes = statusesOf(touchAndGo).filter((status) => status === 'pass').length;
      expect(passes).toBeGreaterThanOrEqual(196);
    });

    it('still catches a soft lockout', () => {
      // 190 of 200 are flagged. Taking the single straightest frame let 17 through.
      const flagged = statusesOf(() => toppingOutAt(0.295)).filter((s) => s !== 'pass').length;
      expect(flagged).toBeGreaterThanOrEqual(185);
    });
  });
});
