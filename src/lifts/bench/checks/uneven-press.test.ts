import { describe, expect, it } from 'vitest';
import { LANDMARK, type LandmarkName, type RepContext } from '../../../core';
import { cleanPoses } from '../../../signal';
import { benchRep, frontBenchFigure } from '../../../testing/bench-pose';
import { jitteredSequence, seededRandom } from '../../../testing/noise';
import { mirrored, setVisibility } from '../../../testing/synthetic-pose';
import { unevenPress } from './uneven-press';

/**
 * A press filmed along the bench. `lagAt` gives how much lower the right hand is, in frame
 * heights, at each point of the rep. The shoulders are 0.2 apart, so 0.03 is 15% of that.
 */
function pressing(
  lagAt: (t: number, rising: boolean) => number,
  from: 'feet' | 'head' = 'feet',
): RepContext {
  return benchRep(from === 'feet' ? 'front' : 'back', (t, rising) => {
    const figure = frontBenchFigure(0.3 - 0.24 * t, lagAt(t, rising));
    return from === 'feet' ? figure : mirrored(figure);
  });
}

/** The right hand falls behind by up to `lag` halfway up, then catches up. */
const laggingOnTheWayUp = (lag: number) =>
  pressing((t, rising) => (rising ? lag * Math.sin(Math.PI * t) : 0));

describe('bench uneven press', () => {
  it('passes hands that press evenly', () => {
    expect(unevenPress.evaluate(pressing(() => 0))).toMatchObject({
      checkId: 'bench.uneven-press',
      status: 'pass',
      message: 'Both hands pressed evenly.',
    });
  });

  it('warns when one hand lags a little, and points at the worst moment', () => {
    expect(unevenPress.evaluate(laggingOnTheWayUp(0.03))).toMatchObject({
      status: 'warn',
      message:
        'The right hand (on the left of the video) lagged behind on the way up, by about 14% of your shoulder width.',
      // Halfway up.
      frameIndex: 55,
    });
  });

  it('fails a hand that lags well behind', () => {
    expect(unevenPress.evaluate(laggingOnTheWayUp(0.05))).toMatchObject({ status: 'fail' });
  });

  it('names the left hand when that one lags', () => {
    expect(unevenPress.evaluate(laggingOnTheWayUp(-0.03))).toMatchObject({
      status: 'warn',
      message: expect.stringContaining(
        'The left hand (on the right of the video) lagged',
      ) as string,
    });
  });

  it('says where the hand is in the video when filmed from the head', () => {
    const fromHead = pressing((t, rising) => (rising ? 0.03 * Math.sin(Math.PI * t) : 0), 'head');
    expect(unevenPress.evaluate(fromHead)).toMatchObject({
      status: 'warn',
      message: expect.stringContaining(
        'The right hand (on the right of the video) lagged',
      ) as string,
    });
  });

  it('allows for a camera that isn’t level, by comparing with the start of the rep', () => {
    expect(unevenPress.evaluate(pressing(() => 0.03))).toMatchObject({ status: 'pass' });
  });

  it('judges only the way up', () => {
    const unevenLowering = pressing((t, rising) => (rising ? 0 : 0.05 * Math.sin(Math.PI * t)));
    expect(unevenPress.evaluate(unevenLowering)).toMatchObject({ status: 'pass' });
  });

  it('skips a rep where the hands are hidden at the start', () => {
    const context = pressing(() => 0);
    const frames = context.sequence.frames.map((frame, index) => {
      if (!frame.landmarks || index > 20) return frame;
      const landmarks = [...frame.landmarks];
      setVisibility(landmarks, 'rightWrist', 0);
      return { ...frame, landmarks };
    });
    const hidden = { ...context, sequence: { ...context.sequence, frames } };
    expect(unevenPress.evaluate(hidden)).toMatchObject({
      status: 'skipped',
      message: "The hands or shoulders weren't seen clearly at the start of this rep.",
    });
  });

  describe('with landmark jitter, cleaned as the pipeline does', () => {
    const everyPoint = Object.keys(LANDMARK) as LandmarkName[];

    function statusesOf(make: () => RepContext) {
      const random = seededRandom(1);
      return Array.from({ length: 200 }, () => {
        const clean = make();
        const noisy = jitteredSequence(clean.sequence, everyPoint, 0.006, random);
        return unevenPress.evaluate({ ...clean, sequence: cleanPoses(noisy) }).status;
      });
    }

    it('passes an even press', () => {
      const flagged = statusesOf(() => pressing(() => 0)).filter((s) => s !== 'pass');
      expect(flagged).toEqual([]);
    });

    it('still catches a hand lagging by 15% of shoulder width', () => {
      // 192 of 200 are flagged.
      const flagged = statusesOf(() => laggingOnTheWayUp(0.03)).filter((s) => s !== 'pass');
      expect(flagged.length).toBeGreaterThanOrEqual(185);
    });
  });
});
