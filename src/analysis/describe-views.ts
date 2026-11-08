import type { View } from '../core';

/** The views a check needs, for a "Needs a side view" message. */
export function describeViews(views: readonly View[]): string {
  return views.join(' or ');
}
