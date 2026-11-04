import { describe, expect, it } from 'vitest';
import type { RepContext } from '../core';
import { sequenceOf, standingFigure } from '../testing/synthetic-pose';
import { repFrames } from './rep-frames';

describe('repFrames', () => {
  it('returns the rep frames with their indices in the whole clip', () => {
    const sequence = sequenceOf(Array.from({ length: 10 }, () => standingFigure('side')));
    const context: RepContext = {
      sequence,
      view: 'side',
      torsoLength: 0.25,
      nearSide: 'left',
      rep: { index: 0, startFrame: 3, turnFrame: 5, endFrame: 7 },
    };

    const frames = repFrames(context);
    expect(frames.map((f) => f.index)).toEqual([3, 4, 5, 6, 7]);
    expect(frames[0]?.frame).toBe(sequence.frames[3]);
  });
});
