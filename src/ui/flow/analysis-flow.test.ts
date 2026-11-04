import { describe, expect, it } from 'vitest';
import type { PreparedClip } from '../../analysis';
import type { SetReport } from '../../report';
import { flowReducer, INITIAL_FLOW, type FlowState } from './analysis-flow';

const videoUrl = 'blob:set';
const raw = { sampleFps: 30, aspectRatio: 0.5625, frames: [] };
const prepared: PreparedClip = {
  sequence: raw,
  torsoLength: 0.25,
  nearSide: 'left',
  viewGuess: { view: 'side', confidence: 'high', reason: '' },
};
const report: SetReport = {
  liftId: 'squat',
  view: 'side',
  nearSide: 'left',
  sampleFps: 30,
  repSignal: [],
  reps: [],
};

describe('flowReducer', () => {
  it('walks from choosing a clip to the results', () => {
    let state: FlowState = INITIAL_FLOW;
    state = flowReducer(state, { type: 'start', liftId: 'squat', videoUrl });
    expect(state).toMatchObject({ step: 'extracting', progress: 0 });

    state = flowReducer(state, { type: 'progress', progress: 0.5 });
    expect(state).toMatchObject({ step: 'extracting', progress: 0.5 });

    state = flowReducer(state, { type: 'extracted', raw, prepared });
    expect(state).toMatchObject({ step: 'confirm-view', liftId: 'squat' });

    state = flowReducer(state, { type: 'analysed', report });
    expect(state).toMatchObject({ step: 'results', report });
  });

  it('goes back to confirming the view without re-running the pose model', () => {
    const results: FlowState = {
      step: 'results',
      liftId: 'squat',
      videoUrl,
      raw,
      prepared,
      report,
    };
    expect(flowReducer(results, { type: 'change-view' })).toMatchObject({
      step: 'confirm-view',
      prepared,
    });
  });

  it('ignores a late progress update after leaving the extracting screen', () => {
    expect(flowReducer(INITIAL_FLOW, { type: 'progress', progress: 0.9 })).toBe(INITIAL_FLOW);
  });

  it('shows an error and can start over', () => {
    const failed = flowReducer(INITIAL_FLOW, { type: 'failed', message: 'Bad file' });
    expect(failed).toEqual({ step: 'error', message: 'Bad file' });
    expect(flowReducer(failed, { type: 'reset' })).toBe(INITIAL_FLOW);
  });
});
