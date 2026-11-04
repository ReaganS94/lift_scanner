import type { FormCheck } from '../../../core';
import type { RepReport } from '../../../report';
import { badgeStagger, STATUS_TEXT } from './status-badge';

interface RepGridProps {
  reps: readonly RepReport[];
  /** The checks to show as columns, in order. */
  checks: readonly Pick<FormCheck, 'id' | 'label'>[];
  selectedRepIndex: number | null;
  /** Shows a rep, paused where a result was measured, or at its start when no frame is given. */
  onShowResult: (repIndex: number, frameIndex: number | undefined) => void;
}

/** Every rep against every check, as a grid of status icons. Tap a cell to see that moment. */
export function RepGrid({ reps, checks, selectedRepIndex, onShowResult }: RepGridProps) {
  return (
    <div className="rep-grid-scroll">
      <table className="rep-grid">
        <thead>
          <tr>
            <th scope="col">Rep</th>
            {checks.map((check) => (
              <th key={check.id} scope="col">
                {check.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reps.map(({ rep, results }) => (
            <tr
              key={rep.index}
              className={rep.index === selectedRepIndex ? 'rep-grid__row--selected' : undefined}
            >
              <th scope="row">
                <button
                  type="button"
                  aria-label={`Show rep ${String(rep.index + 1)}`}
                  onClick={() => {
                    onShowResult(rep.index, undefined);
                  }}
                >
                  {rep.index + 1}
                </button>
              </th>
              {checks.map((check, column) => {
                const result = results.find((candidate) => candidate.checkId === check.id);
                const status = STATUS_TEXT[result?.status ?? 'skipped'];
                const frameIndex = result?.status === 'skipped' ? undefined : result?.frameIndex;
                return (
                  <td key={check.id} className={`check--${result?.status ?? 'skipped'}`}>
                    <button
                      type="button"
                      aria-label={`Rep ${String(rep.index + 1)}, ${check.label}: ${status.label}`}
                      onClick={() => {
                        onShowResult(rep.index, frameIndex);
                      }}
                    >
                      <span
                        className="check__badge"
                        aria-hidden="true"
                        style={badgeStagger(rep.index + column)}
                      >
                        {status.icon}
                      </span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
