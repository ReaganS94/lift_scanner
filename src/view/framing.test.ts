import { describe, expect, it } from 'vitest';
import type { Landmark } from '../core';
import { moved, sequenceOf, setVisibility, standingFigure } from '../testing/synthetic-pose';
import { checkFraming } from './framing';

const second = (figure: Landmark[] | null) => sequenceOf(Array.from({ length: 30 }, () => figure));

/** A front-view figure turned `angle` degrees away from the camera (shoulders narrow by cos). */
function turned(angle: number): Landmark[] {
  const halfWidth = 0.1;
  const shrink = halfWidth * (1 - Math.cos((angle * Math.PI) / 180));
  const front = standingFigure('front');
  return moved(moved(front, ['leftShoulder'], -shrink, 0), ['rightShoulder'], shrink, 0);
}

/** The figure scaled about the frame's top-left corner, as if the phone were further away. */
function scaled(figure: Landmark[], factor: number): Landmark[] {
  return figure.map((point) => ({ ...point, x: point.x * factor, y: point.y * factor }));
}

describe('checkFraming', () => {
  it('passes a whole, side-on lifter who fills the frame', () => {
    expect(checkFraming(second(standingFigure('side')), 'side')).toMatchObject({
      status: 'good',
      tips: [],
    });
  });

  it('asks the lifter to step in when no one is found', () => {
    expect(checkFraming(second(null), 'side').status).toBe('no-one');
  });

  it('says how far off side-on the camera is, first', () => {
    const advice = checkFraming(second(turned(50)), 'side');
    expect(advice.status).toBe('adjust');
    expect(advice.degreesOff).toBeCloseTo(40, 0);
    expect(advice.tips[0]).toContain('40°');
    expect(advice.tips[0]).toContain('corrected');
  });

  it('asks for a real turn past the corrected range', () => {
    const advice = checkFraming(second(turned(20)), 'side');
    expect(advice.tips[0]).toContain('70°');
    expect(advice.tips[0]).not.toContain('corrected');
  });

  it('measures front views from square-on', () => {
    expect(checkFraming(second(standingFigure('front')), 'front').status).toBe('good');
    expect(checkFraming(second(standingFigure('side')), 'front').tips[0]).toContain('faces you');
  });

  it('notices feet out of the picture', () => {
    // The synthetic figure has no real heels, so they are hidden; the ankles go below the frame.
    const cut = moved(standingFigure('side'), ['leftAnkle', 'rightAnkle'], 0, 0.2);
    setVisibility(cut, 'leftHeel', 0);
    setVisibility(cut, 'rightHeel', 0);
    expect(checkFraming(second(cut), 'side').tips).toEqual([
      expect.stringContaining('feet are out of the picture'),
    ]);
  });

  it('notices a head out of the picture', () => {
    const cut = moved(standingFigure('side'), ['nose'], 0, -0.2);
    expect(checkFraming(second(cut), 'side').tips).toEqual([
      expect.stringContaining('head is out of the picture'),
    ]);
  });

  it('asks to move closer when the lifter is small', () => {
    expect(checkFraming(second(scaled(standingFigure('side'), 0.35)), 'side').tips).toEqual([
      expect.stringContaining('closer'),
    ]);
  });

  it('ignores the odd frame where the lifter is lost', () => {
    const frames = Array.from({ length: 30 }, (_, i) =>
      i % 5 === 0 ? null : standingFigure('side'),
    );
    expect(checkFraming(sequenceOf(frames), 'side').status).toBe('good');
  });
});
