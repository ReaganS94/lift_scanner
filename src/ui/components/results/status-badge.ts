import type { CSSProperties } from 'react';
import type { CheckStatus } from '../../../core';

/** The icon and screen-reader text for each check status, shared by every results list. */
export const STATUS_TEXT: Record<CheckStatus, { icon: string; label: string }> = {
  pass: { icon: '✓', label: 'Pass' },
  warn: { icon: '!', label: 'Warning' },
  fail: { icon: '✕', label: 'Fail' },
  skipped: { icon: '–', label: 'Not measured' },
};

/** Staggers a badge's pop-in animation by its position in a list (see styles/motion.css). */
export function badgeStagger(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}
