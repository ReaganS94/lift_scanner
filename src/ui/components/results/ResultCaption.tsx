import type { MeasuredCheckResult } from '../../../core';
import { STATUS_TEXT } from './status-badge';

interface ResultCaptionProps {
  result: MeasuredCheckResult;
  label: string;
}

/** The result being shown, laid over the top of the video while paused on its frame. */
export function ResultCaption({ result, label }: ResultCaptionProps) {
  const status = STATUS_TEXT[result.status];
  return (
    <div className={`result-caption check--${result.status}`} role="status">
      <span className="check__badge" aria-hidden="true">
        {status.icon}
      </span>
      <span>
        <span className="visually-hidden">{status.label}: </span>
        <strong>{label}</strong> {result.message}
      </span>
    </div>
  );
}
