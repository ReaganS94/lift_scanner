import type { BodySide, CheckResult, View } from '../core';

/** Everything the app shows about one analysed photo of a lift position. */
export interface PhotoReport {
  /** The LiftPosition the photo was checked as, e.g. 'squat.bottom'. */
  readonly positionId: string;
  readonly view: View;
  readonly nearSide: BodySide;
  /** As on SetReport: degrees off side-on the angles were corrected for, if any. */
  readonly correctedForDegrees?: number;
  /** One result per check of the position, in the position's order. */
  readonly results: readonly CheckResult[];
}
