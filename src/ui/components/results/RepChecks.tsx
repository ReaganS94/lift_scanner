import type { CheckResult, MeasuredCheckResult } from '../../../core';
import { badgeStagger, STATUS_TEXT } from './status-badge';

interface RepChecksProps {
  results: readonly CheckResult[];
  /** The label shown for each check id. */
  labels: ReadonlyMap<string, string>;
  /** Jumps the video to where a result was measured. */
  onShowResult: (result: MeasuredCheckResult) => void;
}

/** The form check results for one rep. Each measured result links to its moment in the video. */
export function RepChecks({ results, labels, onShowResult }: RepChecksProps) {
  if (results.length === 0) return null;
  return (
    <ul className="check-list">
      {results.map((result, index) => {
        const status = STATUS_TEXT[result.status];
        const content = (
          <>
            <span className="check__badge" aria-hidden="true" style={badgeStagger(index)}>
              {status.icon}
            </span>
            <span>
              <span className="visually-hidden">{status.label}: </span>
              <strong>{labels.get(result.checkId) ?? result.checkId}</strong> {result.message}
            </span>
          </>
        );
        const measured =
          result.status !== 'skipped' && result.frameIndex !== undefined ? result : null;
        return (
          <li key={result.checkId} className={`check check--${result.status}`}>
            {measured === null ? (
              <div className="check__body">{content}</div>
            ) : (
              <button
                type="button"
                className="check__body"
                onClick={() => {
                  onShowResult(measured);
                }}
              >
                {content}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
