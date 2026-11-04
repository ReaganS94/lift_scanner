import type { CheckSummary } from '../../../report';
import { checkSummaryText } from './check-summary-text';
import { STATUS_TEXT } from './status-badge';

interface CheckSummaryListProps {
  summaries: readonly CheckSummary[];
  labels: ReadonlyMap<string, string>;
  /** Shows the worst rep for a check, paused where it was measured. */
  onShowResult: (repIndex: number, frameIndex: number | undefined) => void;
}

/** One line per form check for the whole set, worst rep first. */
export function CheckSummaryList({ summaries, labels, onShowResult }: CheckSummaryListProps) {
  if (summaries.length === 0) return null;
  return (
    <ul className="check-list check-list--summary">
      {summaries.map((summary) => {
        const status = STATUS_TEXT[summary.worst];
        const { example } = summary;
        const content = (
          <>
            <span className="check__badge" aria-hidden="true">
              {status.icon}
            </span>
            <span>
              <span className="visually-hidden">{status.label}: </span>
              <strong>{labels.get(summary.checkId) ?? summary.checkId}</strong>{' '}
              {checkSummaryText(summary)}
              {example && summary.worst !== 'pass' && (
                <span className="check__example muted">
                  Rep {example.repIndex + 1}: {example.result.message}
                </span>
              )}
            </span>
          </>
        );
        return (
          <li key={summary.checkId} className={`check check--${summary.worst}`}>
            {example ? (
              <button
                type="button"
                className="check__body"
                onClick={() => {
                  onShowResult(example.repIndex, example.result.frameIndex);
                }}
              >
                {content}
              </button>
            ) : (
              <div className="check__body">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
