import type { CheckResult } from '../../../core';
import { STATUS_TEXT } from './status-badge';

interface RepChecksProps {
  results: readonly CheckResult[];
  /** The label shown for each check id. */
  labels: ReadonlyMap<string, string>;
  /** Jumps the video to a frame of the clip, to show where a result was measured. */
  onShowFrame: (frameIndex: number) => void;
}

/** The form check results for one rep. Each measured result links to its moment in the video. */
export function RepChecks({ results, labels, onShowFrame }: RepChecksProps) {
  if (results.length === 0) return null;
  return (
    <ul className="check-list">
      {results.map((result) => {
        const status = STATUS_TEXT[result.status];
        const content = (
          <>
            <span className="check__badge" aria-hidden="true">
              {status.icon}
            </span>
            <span>
              <span className="visually-hidden">{status.label}: </span>
              <strong>{labels.get(result.checkId) ?? result.checkId}</strong> {result.message}
            </span>
          </>
        );
        const frameIndex = result.status === 'skipped' ? undefined : result.frameIndex;
        return (
          <li key={result.checkId} className={`check check--${result.status}`}>
            {frameIndex === undefined ? (
              <div className="check__body">{content}</div>
            ) : (
              <button
                type="button"
                className="check__body"
                onClick={() => {
                  onShowFrame(frameIndex);
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
