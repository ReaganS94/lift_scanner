import { describe, expect, it } from 'vitest';
import type { CheckResult } from '../core';
import { summarizeByCheck } from './check-summary';
import type { SetReport } from './set-report';

function reportWith(...repResults: (readonly CheckResult[])[]): SetReport {
  return {
    liftId: 'squat',
    view: 'side',
    nearSide: 'left',
    sampleFps: 30,
    repSignal: [],
    reps: repResults.map((results, index) => ({
      rep: { index, startFrame: index * 10, turnFrame: index * 10 + 5, endFrame: index * 10 + 9 },
      results,
    })),
  };
}

describe('summarizeByCheck', () => {
  it('counts each check across reps and picks the first rep with the worst result', () => {
    const report = reportWith(
      [{ checkId: 'depth', status: 'pass', message: 'ok' }],
      [{ checkId: 'depth', status: 'fail', message: 'high', frameIndex: 15 }],
      [{ checkId: 'depth', status: 'fail', message: 'higher', frameIndex: 25 }],
    );

    const [depth] = summarizeByCheck(report, ['depth']);

    expect(depth?.counts).toEqual({ pass: 1, warn: 0, fail: 2, skipped: 0 });
    expect(depth?.worst).toBe('fail');
    expect(depth?.example?.repIndex).toBe(1);
    expect(depth?.example?.result.message).toBe('high');
  });

  it('ranks a warning above a pass', () => {
    const report = reportWith(
      [{ checkId: 'a', status: 'pass', message: '' }],
      [{ checkId: 'a', status: 'warn', message: 'w' }],
    );

    expect(summarizeByCheck(report, ['a'])[0]?.worst).toBe('warn');
  });

  it('reports a check that was never measured as skipped, with no example', () => {
    const report = reportWith(
      [{ checkId: 'a', status: 'skipped', message: 'not seen' }],
      [{ checkId: 'b', status: 'pass', message: '' }],
    );

    const [a, missing] = summarizeByCheck(report, ['a', 'zzz']);

    expect(a).toEqual({
      checkId: 'a',
      counts: { pass: 0, warn: 0, fail: 0, skipped: 1 },
      worst: 'skipped',
    });
    expect(missing?.counts).toEqual({ pass: 0, warn: 0, fail: 0, skipped: 0 });
  });

  it('keeps the order of the check ids it was given', () => {
    const report = reportWith([
      { checkId: 'a', status: 'pass', message: '' },
      { checkId: 'b', status: 'pass', message: '' },
    ]);

    expect(summarizeByCheck(report, ['b', 'a']).map((s) => s.checkId)).toEqual(['b', 'a']);
  });
});
