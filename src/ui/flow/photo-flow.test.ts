import { describe, expect, it } from 'vitest';
import type { PreparedClip } from '../../analysis';
import type { PhotoReport } from '../../report';
import { IDLE_PHOTO_FLOW, photoFlowReducer, positionOf, type PhotoFlowState } from './photo-flow';

const photo = { url: 'blob:photo', aspectRatio: 0.75 };
const raw = { sampleFps: 1, aspectRatio: 0.75, frames: [] };
const prepared: PreparedClip = {
  sequence: raw,
  torsoLength: 0.25,
  nearSide: 'left',
  viewGuess: { view: 'side', confidence: 'high', reason: '', angleFromSide: 5 },
};
const report: PhotoReport = {
  positionId: 'squat.bottom',
  view: 'side',
  nearSide: 'left',
  results: [],
};

describe('photoFlowReducer', () => {
  it('walks from choosing a photo to the results', () => {
    let state: PhotoFlowState = IDLE_PHOTO_FLOW;
    state = photoFlowReducer(state, { type: 'start', liftId: 'squat', positionId: 'squat.bottom' });
    expect(state).toEqual({ step: 'reading', liftId: 'squat', positionId: 'squat.bottom' });

    state = photoFlowReducer(state, { type: 'read', photo, raw, prepared });
    expect(state).toMatchObject({ step: 'confirm-view', positionId: 'squat.bottom', photo });

    state = photoFlowReducer(state, { type: 'analysed', report });
    expect(state).toMatchObject({ step: 'results', report });

    state = photoFlowReducer(state, { type: 'change-view' });
    expect(state).toMatchObject({ step: 'confirm-view', photo });
    expect(state).not.toHaveProperty('report');
  });

  it('ignores a photo that finishes reading after the user started over', () => {
    const state = photoFlowReducer(IDLE_PHOTO_FLOW, { type: 'read', photo, raw, prepared });
    expect(state).toBe(IDLE_PHOTO_FLOW);
  });
});

describe('positionOf', () => {
  it('finds a registered position of a lift, and nothing for a mismatch', () => {
    expect(positionOf('squat', 'squat.bottom')?.name).toBe('Bottom');
    expect(positionOf('bench', 'squat.bottom')).toBeUndefined();
  });
});
