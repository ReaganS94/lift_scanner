import { describe, expect, it } from 'vitest';
import type { Landmark } from '../core';
import { moved, sequenceOf, setVisibility, standingFigure } from '../testing/synthetic-pose';
import { detectView } from './detect-view';

const clip = (figure: Landmark[]) => sequenceOf(Array.from({ length: 30 }, () => figure));

/** A front-view figure turned `angle` degrees away from the camera (shoulders narrow by cos). */
function turned(angle: number): Landmark[] {
  const front = standingFigure('front');
  const halfWidth = 0.1; // the synthetic figure's shoulders sit 0.1 either side of centre
  const shrink = halfWidth * (1 - Math.cos((angle * Math.PI) / 180));
  return moved(moved(front, ['leftShoulder'], -shrink, 0), ['rightShoulder'], shrink, 0);
}

describe('detectView', () => {
  it('recognises a side view', () => {
    expect(detectView(clip(standingFigure('side')))).toMatchObject({
      view: 'side',
      confidence: 'high',
    });
  });

  it('recognises a front view', () => {
    expect(detectView(clip(standingFigure('front')))).toMatchObject({
      view: 'front',
      confidence: 'high',
    });
  });

  it('recognises a back view from the hidden face', () => {
    expect(detectView(clip(standingFigure('back')))).toMatchObject({
      view: 'back',
      confidence: 'high',
    });
  });

  it('gives no view between 45 and 60 degrees off side-on', () => {
    expect(detectView(clip(turned(35))).view).toBeNull();
  });

  it('calls 40 degrees off side-on a side view, unsure, and says how far off it is', () => {
    const guess = detectView(clip(turned(50)));
    expect(guess).toMatchObject({ view: 'side', confidence: 'low' });
    expect(guess.angleFromSide).toBeCloseTo(40, 0);
    expect(guess.reason).toContain('40°');
  });

  it('measures the angle from side-on', () => {
    expect(detectView(clip(turned(20))).angleFromSide).toBeCloseTo(70, 0);
    expect(detectView(clip(standingFigure('side'))).angleFromSide).toBeLessThan(10);
  });

  it('still calls it a front view at 20 degrees off square-on', () => {
    expect(detectView(clip(turned(20))).view).toBe('front');
  });

  it('still calls it a side view at 20 degrees off side-on', () => {
    expect(detectView(clip(turned(70))).view).toBe('side');
  });

  it('measures on full-length torso frames, so leaning at the bottom does not skew it', () => {
    // Standing at 55° off square-on (35° from front), then bent over towards the camera (torso foreshortened to 60%),
    // which on its own would push the ratio into the front range.
    const standing = turned(35);
    const bent = moved(standing, ['leftShoulder', 'rightShoulder'], 0, 0.1);
    const frames = [
      ...Array.from({ length: 10 }, () => standing),
      ...Array.from({ length: 20 }, () => bent),
    ];
    expect(detectView(sequenceOf(frames)).view).toBeNull();
  });

  it('works when the far side is only faintly visible, as in a real side view', () => {
    const side = standingFigure('side');
    for (const name of ['rightShoulder', 'rightHip', 'rightElbow', 'rightKnee'] as const) {
      setVisibility(side, name, 0.3);
    }
    expect(detectView(clip(side))).toMatchObject({ view: 'side', confidence: 'high' });
  });

  it('lowers confidence when the cues disagree', () => {
    const front = standingFigure('front');
    setVisibility(front, 'nose', 0.1); // face hidden, but shoulders mirrored like a front view
    expect(detectView(clip(front))).toMatchObject({ view: 'back', confidence: 'low' });
  });

  it('gives no view when no one is in frame', () => {
    expect(detectView(sequenceOf([null, null])).view).toBeNull();
  });
});
