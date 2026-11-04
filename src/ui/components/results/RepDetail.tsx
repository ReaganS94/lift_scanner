import type { RepReport } from '../../../report';
import { formatSeconds, timeOfFrame } from '../../playback/frames';
import { RepChecks } from './RepChecks';

interface RepDetailProps {
  repReport: RepReport;
  sampleFps: number;
  /** Results of checks that can't run from this view are left out. */
  hiddenCheckIds: ReadonlySet<string>;
  labels: ReadonlyMap<string, string>;
  onPlay: () => void;
  onShowFrame: (frameIndex: number) => void;
}

/** The selected rep's full results, each linking to the moment it was measured. */
export function RepDetail({
  repReport: { rep, results },
  sampleFps,
  hiddenCheckIds,
  labels,
  onPlay,
  onShowFrame,
}: RepDetailProps) {
  return (
    <section className="rep-card" aria-label={`Rep ${String(rep.index + 1)} details`}>
      <div className="rep-card__header">
        <span>
          <strong>Rep {rep.index + 1}</strong>{' '}
          <span className="muted">
            {formatSeconds(timeOfFrame(rep.startFrame, sampleFps))} to{' '}
            {formatSeconds(timeOfFrame(rep.endFrame, sampleFps))}
          </span>
        </span>
        <button type="button" onClick={onPlay}>
          ▶ Play rep
        </button>
      </div>
      <RepChecks
        results={results.filter((result) => !hiddenCheckIds.has(result.checkId))}
        labels={labels}
        onShowFrame={onShowFrame}
      />
    </section>
  );
}
