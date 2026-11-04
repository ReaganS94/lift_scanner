import { describe, expect, it } from 'vitest';
import { estimateRemainingSeconds, formatDuration } from './progress-time';

describe('estimateRemainingSeconds', () => {
  it('assumes the rest goes at the pace so far', () => {
    expect(estimateRemainingSeconds(30, 0.25)).toBe(90);
  });

  it('waits for enough progress before guessing', () => {
    expect(estimateRemainingSeconds(10, 0.01)).toBeNull();
  });

  it('gives nothing once finished', () => {
    expect(estimateRemainingSeconds(60, 1)).toBeNull();
  });
});

describe('formatDuration', () => {
  it('shows seconds under a minute', () => {
    expect(formatDuration(44.6)).toBe('45 s');
  });

  it('shows minutes and padded seconds', () => {
    expect(formatDuration(125)).toBe('2 min 05 s');
  });

  it('never shows a negative time', () => {
    expect(formatDuration(-3)).toBe('0 s');
  });
});
