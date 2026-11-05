import type { BodySide, CheckResult, Rep, View } from '../core';

/** The results of every check on one rep. */
export interface RepReport {
  readonly rep: Rep;
  readonly results: readonly CheckResult[];
}

/** Everything the app shows and saves about one analysed set. */
export interface SetReport {
  readonly liftId: string;
  readonly view: View;
  readonly nearSide: BodySide;
  /**
   * For a side view, how many degrees off side-on the angles were corrected for. Absent when the
   * camera angle wasn't known or the view isn't side.
   */
  readonly correctedForDegrees?: number;
  readonly sampleFps: number;
  /** The lift's rep signal for every frame, for charting the set. */
  readonly repSignal: readonly (number | null)[];
  readonly reps: readonly RepReport[];
}

export interface ReportSummary {
  readonly reps: number;
  readonly pass: number;
  readonly warn: number;
  readonly fail: number;
  readonly skipped: number;
}

/** Counts results by status across all reps. */
export function summarize(report: SetReport): ReportSummary {
  const counts = { pass: 0, warn: 0, fail: 0, skipped: 0 };
  for (const { results } of report.reps) {
    for (const result of results) counts[result.status]++;
  }
  return { reps: report.reps.length, ...counts };
}
