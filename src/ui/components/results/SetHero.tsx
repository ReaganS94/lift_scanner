import type { MeasuredCheckResult } from '../../../core';
import { worstStatus, type CheckSummary, type RepReport } from '../../../report';
import { badgeStagger } from './status-badge';

interface SetHeroProps {
  liftName: string;
  reps: readonly RepReport[];
  summaries: readonly CheckSummary[];
  labels: ReadonlyMap<string, string>;
  /** Check ids whose results count towards each rep's colour. */
  shownCheckIds: ReadonlySet<string>;
  selectedRepIndex: number | null;
  onShowResult: (repIndex: number, result?: MeasuredCheckResult) => void;
}

/**
 * The set at a glance: the lift and rep count in big type, one score tile per check (reps
 * passed out of reps measured), and a chip per rep in its worst result's colour.
 */
export function SetHero({
  liftName,
  reps,
  summaries,
  labels,
  shownCheckIds,
  selectedRepIndex,
  onShowResult,
}: SetHeroProps) {
  return (
    <section className="hero">
      <h2 className="hero__title">
        <span className="hero__lift">{liftName}</span>
        <span className="hero__count">{reps.length}</span> {reps.length === 1 ? 'rep' : 'reps'}
      </h2>

      {summaries.length > 0 && (
        <ul className="hero__tiles">
          {summaries.map((summary, index) => {
            const measured = summary.counts.pass + summary.counts.warn + summary.counts.fail;
            const label = labels.get(summary.checkId) ?? summary.checkId;
            const { example } = summary;
            return (
              <li key={summary.checkId}>
                <button
                  type="button"
                  className={`hero__tile check--${summary.worst}`}
                  style={badgeStagger(index)}
                  disabled={!example}
                  aria-label={`${label}: ${String(summary.counts.pass)} of ${String(measured)} reps passed`}
                  onClick={() => {
                    if (example) onShowResult(example.repIndex, example.result);
                  }}
                >
                  <span className="hero__score display">
                    {measured === 0 ? '–' : `${String(summary.counts.pass)}/${String(measured)}`}
                  </span>
                  <span className="hero__label">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {reps.length > 0 && (
        <div className="rep-chips" role="group" aria-label="Reps">
          {reps.map(({ rep, results }, index) => {
            const status = worstStatus(
              results
                .filter((result) => shownCheckIds.has(result.checkId))
                .map((result) => result.status),
            );
            return (
              <button
                key={rep.index}
                type="button"
                className={`rep-chip check--${status}${rep.index === selectedRepIndex ? ' rep-chip--selected' : ''}`}
                style={badgeStagger(index)}
                aria-label={`Rep ${String(rep.index + 1)}`}
                onClick={() => {
                  onShowResult(rep.index);
                }}
              >
                {rep.index + 1}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
