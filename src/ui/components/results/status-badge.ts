import type { CheckStatus } from '../../../core';

/** The icon and screen-reader text for each check status, shared by every results list. */
export const STATUS_TEXT: Record<CheckStatus, { icon: string; label: string }> = {
  pass: { icon: '✓', label: 'Pass' },
  warn: { icon: '!', label: 'Warning' },
  fail: { icon: '✕', label: 'Fail' },
  skipped: { icon: '–', label: 'Not measured' },
};
