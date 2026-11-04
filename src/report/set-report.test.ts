import { describe, expect, it } from 'vitest';
import { summarize, type SetReport } from './set-report';

describe('summarize', () => {
  it('counts results by status across reps', () => {
    const rep = { index: 0, startFrame: 0, turnFrame: 1, endFrame: 2 };
    const report: SetReport = {
      liftId: 'squat',
      view: 'side',
      nearSide: 'left',
      sampleFps: 30,
      repSignal: [],
      reps: [
        {
          rep,
          results: [
            { checkId: 'a', status: 'pass', message: '' },
            { checkId: 'b', status: 'skipped', message: 'Needs a front view' },
          ],
        },
        { rep: { ...rep, index: 1 }, results: [{ checkId: 'a', status: 'fail', message: '' }] },
      ],
    };

    expect(summarize(report)).toEqual({ reps: 2, pass: 1, warn: 0, fail: 1, skipped: 1 });
  });
});
