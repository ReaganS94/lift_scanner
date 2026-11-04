import { describe, expect, it } from 'vitest';
import { sequenceOf, setVisibility, standingFigure } from '../testing/synthetic-pose';
import { nearSide, sidePoint } from './body-side';

describe('nearSide', () => {
  it('picks the side the model saw more clearly', () => {
    const figure = standingFigure('side');
    for (const joint of ['Shoulder', 'Elbow', 'Wrist', 'Hip', 'Knee', 'Ankle'] as const) {
      setVisibility(figure, `left${joint}`, 0.3);
    }
    expect(nearSide(sequenceOf([figure, figure]).frames)).toBe('right');
  });

  it('prefers the left side on a tie', () => {
    expect(nearSide(sequenceOf([standingFigure('side')]).frames)).toBe('left');
  });
});

describe('sidePoint', () => {
  it('reads a joint on the given side', () => {
    const [frame] = sequenceOf([standingFigure('front')]).frames;
    if (!frame) throw new Error('missing frame');
    const left = sidePoint(frame, 'left', 'Hip');
    const right = sidePoint(frame, 'right', 'Hip');
    expect(left?.x).toBeGreaterThan(right?.x ?? Infinity);
  });
});
