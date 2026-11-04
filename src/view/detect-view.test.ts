import { describe, expect, it } from 'vitest';
import type { Landmark } from '../core';
import { moved, sequenceOf, setVisibility, standingFigure } from '../testing/synthetic-pose';
import { detectView } from './detect-view';

const clip = (figure: Landmark[]) => sequenceOf(Array.from({ length: 30 }, () => figure));

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

  it('gives no view for a 45 degree angle', () => {
    // Shoulders about half as wide as in a front view.
    const front = standingFigure('front');
    const angled = moved(moved(front, ['leftShoulder'], -0.045, 0), ['rightShoulder'], 0.045, 0);
    expect(detectView(clip(angled)).view).toBeNull();
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
