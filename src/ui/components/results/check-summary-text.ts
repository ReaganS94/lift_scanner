import type { CheckSummary } from '../../../report';

/** One line on how a check went across the set, e.g. "Failed on 2 of 3 reps". */
export function checkSummaryText({ counts, worst }: CheckSummary): string {
  const measured = counts.pass + counts.warn + counts.fail;
  if (measured === 0) return 'Couldn’t be measured on any rep.';

  const of = (count: number) =>
    `${String(count)} of ${String(measured)} ${measured === 1 ? 'rep' : 'reps'}`;
  const main =
    worst === 'fail'
      ? `Failed on ${of(counts.fail)}`
      : worst === 'warn'
        ? `Warning on ${of(counts.warn)}`
        : measured === 1
          ? 'Passed'
          : `Passed on all ${String(measured)} reps`;
  const unmeasured = counts.skipped > 0 ? `, not measured on ${String(counts.skipped)}` : '';
  return `${main}${unmeasured}.`;
}
