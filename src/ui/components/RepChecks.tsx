import type { CheckResult, CheckStatus } from '../../core';

interface RepChecksProps {
  results: readonly CheckResult[];
  /** The label shown for each check id. */
  labels: ReadonlyMap<string, string>;
  /** Jumps the video to a frame of the clip, to show where a result was measured. */
  onShowFrame: (frameIndex: number) => void;
}

const STATUS_TEXT: Record<CheckStatus, { icon: string; label: string }> = {
  pass: { icon: '✓', label: 'Pass' },
  warn: { icon: '!', label: 'Warning' },
  fail: { icon: '✕', label: 'Fail' },
  skipped: { icon: '–', label: 'Not measured' },
};

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
