import { describe, expect, it } from 'vitest';
import type { Landmark, PoseSequence } from '../core';
import { PORTRAIT_ASPECT, standingFigure } from '../testing/synthetic-pose';
import { pickLifter } from './pick-lifter';

const FPS = 30;

/** A standing person, `scale` times the test figure's size, with the hips' middle at x. */
function personAt(x: number, scale: number, top = 0.1): Landmark[] {
  return standingFigure('side').map((point) => ({
    ...point,
    x: x + (point.x - PORTRAIT_ASPECT / 2) * scale,
    y: top + point.y * scale,
  }));
}

/** A clip whose frames hold the given people, `null` for a person not in that frame. */
function clip(people: ((frame: number) => Landmark[] | null)[], frames: number): PoseSequence {
  return {
    sampleFps: FPS,
    aspectRatio: PORTRAIT_ASPECT,
    frames: Array.from({ length: frames }, (_, frame) => {
      const found = people.flatMap((person) => {
        const landmarks = person(frame);
        return landmarks ? [landmarks] : [];
      });
      return { timeMs: (frame * 1000) / FPS, landmarks: found[0] ?? null, people: found };
    }),
  };
}

/** Where the picked pose's hips are in each frame, or null. */
function hipsX(sequence: PoseSequence): (number | null)[] {
  return sequence.frames.map((frame) => {
    const hip = frame.landmarks?.[23];
    return hip ? Math.round(hip.x * 100) / 100 : null;
  });
}

// A lifter bobbing up and down in one place, half the frame tall.
const lifter = (frame: number) => personAt(0.2, 0.5, 0.3 + 0.05 * Math.sin(frame / 10));

describe('pickLifter', () => {
  it('ignores someone walking past who was found first', () => {
    // Crosses the frame in 1.5 s, bigger than the lifter and listed first while there.
    const walker = (frame: number) => (frame < 45 ? personAt(0.05 + frame * 0.01, 0.7) : null);
    const picked = pickLifter(clip([walker, lifter], 150));
    expect(hipsX(picked).every((x) => x === 0.2)).toBe(true);
  });

  it('prefers the lifter over a smaller person exercising behind them the whole time', () => {
    const behind = (frame: number) => personAt(0.42 + 0.02 * Math.sin(frame / 7), 0.25, 0.1);
    const picked = pickLifter(clip([behind, lifter], 150));
    expect(hipsX(picked).every((x) => x === 0.2)).toBe(true);
  });

  it('keeps a lifter who walks in to the bar, then stays', () => {
    const walksIn = (frame: number) => personAt(Math.min(0.2, frame * 0.01 - 0.2), 0.5);
    const passerBy = (frame: number) =>
      frame >= 60 && frame < 100 ? personAt(0.5 - (frame - 60) * 0.01, 0.3, 0.05) : null;
    const picked = pickLifter(clip([passerBy, walksIn], 200));
    expect(hipsX(picked).slice(40)).toEqual(Array<number>(160).fill(0.2));
  });

  it('gives no pose where only someone else was found', () => {
    const late = (frame: number) => (frame >= 20 ? lifter(frame) : null);
    const walker = (frame: number) => (frame < 10 ? personAt(0.1 + frame * 0.01, 0.4) : null);
    const picked = pickLifter(clip([walker, late], 120));
    expect(hipsX(picked).slice(0, 20)).toEqual(Array<null>(20).fill(null));
    expect(hipsX(picked)[20]).toBe(0.2);
  });

  it('works on clips recorded before more than one person was kept', () => {
    const single: PoseSequence = {
      sampleFps: FPS,
      aspectRatio: PORTRAIT_ASPECT,
      frames: [0, 1, 2].map((frame) => ({ timeMs: frame * 33, landmarks: lifter(frame) })),
    };
    expect(hipsX(pickLifter(single))).toEqual([0.2, 0.2, 0.2]);
  });

  it('counts the lifter found twice in one frame as one person', () => {
    // The tracker and the finder both see the lifter, a hair apart.
    const twice = (frame: number) => personAt(0.2005, 0.5, 0.3 + 0.05 * Math.sin(frame / 10));
    const walker = (frame: number) => personAt(0.05 + frame * 0.002, 0.55, 0.05);
    const picked = pickLifter(clip([lifter, twice, walker], 150));
    expect(hipsX(picked).every((x) => x === 0.2)).toBe(true);
  });

  it('joins up the lifter when the model loses them for a while', () => {
    const gappy = (frame: number) => (frame >= 60 && frame < 90 ? null : lifter(frame));
    const picked = pickLifter(clip([gappy], 200));
    const seen = hipsX(picked).filter((x) => x === 0.2).length;
    expect(seen).toBe(170);
  });

  it("doesn't join someone smaller crossing behind while the lifter is hidden", () => {
    const hidden = (frame: number) => (frame >= 60 && frame < 90 ? null : lifter(frame));
    const behind = (frame: number) =>
      frame >= 60 && frame < 90 ? personAt(0.1 + (frame - 60) * 0.007, 0.3, 0.25) : null;
    const picked = pickLifter(clip([behind, hidden], 200));
    expect(hipsX(picked).slice(60, 90)).toEqual(Array<null>(30).fill(null));
  });

  it('picks the lifter when the tracker follows someone behind them the whole clip', () => {
    // The tracker lists the background person in every frame; the finder adds the lifter one
    // frame in five. Being listed more often mustn't win it for the background person.
    for (const [scale, wobble] of [
      [0.25, 0.02],
      [0.3, 0.05],
      [0.35, 0.02],
    ] as const) {
      const background = (frame: number) =>
        personAt(0.42 + wobble * Math.sin(frame / 7), scale, 0.1);
      const lifterOnFinderFrames = (frame: number) => (frame % 5 === 0 ? lifter(frame) : null);
      const picked = pickLifter(clip([background, lifterOnFinderFrames], 300));
      const onLifter = hipsX(picked).filter((x) => x === 0.2).length;
      expect(onLifter).toBe(60);
      expect(hipsX(picked).filter((x) => x !== null && x !== 0.2)).toEqual([]);
    }
  });
});
