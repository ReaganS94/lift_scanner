import { describe, expect, it } from 'vitest';
import { sequenceOf } from '../../testing/synthetic-pose';
import { sideSquatFigure, sideSquatRep } from '../../testing/squat-pose';
import { squatBottom, thighBelowParallel } from './bottom';

function thighAngleOf(position: { thighBelowParallel: number; torsoLean: number }) {
  const frame = sequenceOf([sideSquatFigure(position)]).frames[0];
  if (!frame) throw new Error('no frame');
  return thighBelowParallel(frame, 'left');
}

describe('thighBelowParallel', () => {
  it('reads -90 standing, 0 at parallel and positive below', () => {
    expect(thighAngleOf({ thighBelowParallel: -90, torsoLean: 0 })).toBeCloseTo(-90);
    expect(thighAngleOf({ thighBelowParallel: 0, torsoLean: 40 })).toBeCloseTo(0);
    expect(thighAngleOf({ thighBelowParallel: 15, torsoLean: 40 })).toBeCloseTo(15);
  });
});

describe('squatBottom', () => {
  it('finds the deepest frame', () => {
    const bottom = squatBottom(sideSquatRep({ thighBelowParallel: 10, torsoLean: 40 }));
    expect(bottom).toMatchObject({ frameIndex: 40 });
    expect(bottom?.thighBelowParallel).toBeCloseTo(10);
  });

  it('looks only near where the hips were lowest', () => {
    // The thigh angle never changes, so every frame ties. Picking the first frame of the rep
    // would judge the lifter standing rather than at the bottom.
    const still = sideSquatFigure({ thighBelowParallel: -40, torsoLean: 10 });
    const context = sideSquatRep({ thighBelowParallel: 0, torsoLean: 10 }, () => still);
    const bottom = squatBottom(context);
    expect(bottom).not.toBeNull();
    expect(Math.abs((bottom?.frameIndex ?? 0) - context.rep.turnFrame)).toBeLessThanOrEqual(8);
  });
});
