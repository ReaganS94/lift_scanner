import { describe, expect, it } from 'vitest';
import type { CheckSummary } from '../../../report';
import { checkSummaryText } from './check-summary-text';

const summary = (counts: CheckSummary['counts'], worst: CheckSummary['worst']): CheckSummary => ({
  checkId: 'depth',
  counts,
  worst,
});

describe('checkSummaryText', () => {
  it('counts fails out of the measured reps', () => {
    expect(checkSummaryText(summary({ pass: 1, warn: 0, fail: 2, skipped: 0 }, 'fail'))).toBe(
      'Failed on 2 of 3 reps.',
    );
  });

  it('names warnings when nothing failed', () => {
    expect(checkSummaryText(summary({ pass: 2, warn: 1, fail: 0, skipped: 0 }, 'warn'))).toBe(
      'Warning on 1 of 3 reps.',
    );
  });

  it('says every measured rep passed, and how many were not measured', () => {
    expect(checkSummaryText(summary({ pass: 2, warn: 0, fail: 0, skipped: 1 }, 'pass'))).toBe(
      'Passed on all 2 reps, not measured on 1.',
    );
  });

  it('says when no rep could be measured', () => {
    expect(checkSummaryText(summary({ pass: 0, warn: 0, fail: 0, skipped: 3 }, 'skipped'))).toBe(
      'Couldn’t be measured on any rep.',
    );
  });
});
