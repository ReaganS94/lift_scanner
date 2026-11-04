import type { CheckStatus, MeasuredCheckResult } from '../core';
import type { SetReport } from './set-report';

/** How one form check went across every rep of a set. */
export interface CheckSummary {
  readonly checkId: string;
  /** How many reps got each status. */
  readonly counts: Readonly<Record<CheckStatus, number>>;
  /** The most serious status any rep got: fail, then warn, then pass, then skipped. */
  readonly worst: CheckStatus;
  /** The first rep with the worst measured status, to show and link to. Absent if none measured. */
  readonly example?: { readonly repIndex: number; readonly result: MeasuredCheckResult };
}

const SEVERITY: Record<CheckStatus, number> = { skipped: 0, pass: 1, warn: 2, fail: 3 };

/**
 * Groups a set's results by check rather than by rep, in the order of `checkIds`. A check no rep
 * reported on comes back as skipped with zero counts.
 */
export function summarizeByCheck(
  report: SetReport,
  checkIds: readonly string[],
): readonly CheckSummary[] {
  return checkIds.map((checkId) => {
    const counts: Record<CheckStatus, number> = { pass: 0, warn: 0, fail: 0, skipped: 0 };
    let worst: CheckStatus = 'skipped';
    let example: CheckSummary['example'];

    for (const { rep, results } of report.reps) {
      const result = results.find((candidate) => candidate.checkId === checkId);
      if (!result) continue;
      counts[result.status]++;
      if (result.status === 'skipped') continue;
      if (!example || SEVERITY[result.status] > SEVERITY[worst]) {
        worst = result.status;
        example = { repIndex: rep.index, result };
      }
    }

    return example ? { checkId, counts, worst, example } : { checkId, counts, worst };
  });
}
