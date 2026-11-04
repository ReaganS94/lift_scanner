import { useRef } from 'react';
import type { PreparedClip } from '../../analysis';
import type { PoseSequence, Rep } from '../../core';
import { liftRegistry } from '../../lifts';
import { summarize, type SetReport } from '../../report';
import { downloadJson } from '../download';
import { viewLabel } from '../flow/analysis-flow';
import { RepSignalChart } from './RepSignalChart';
import { SkeletonOverlay } from './SkeletonOverlay';

interface SetResultsProps {
  videoUrl: string;
  raw: PoseSequence;
  prepared: PreparedClip;
  report: SetReport;
  onChangeView: () => void;
  onStartOver: () => void;
}

/** The analysed set: the video with the skeleton drawn over it, and the reps found. */
export function SetResults({
  videoUrl,
  raw,
  prepared,
  report,
  onChangeView,
  onStartOver,
}: SetResultsProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lift = liftRegistry.get(report.liftId);
  const summary = summarize(report);

  const seekTo = (rep: Rep) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = rep.startFrame / report.sampleFps;
    void video.play();
  };

  return (
    <div className="stack">
      <h2>
        {lift?.name ?? report.liftId}: {summary.reps} {summary.reps === 1 ? 'rep' : 'reps'} found
      </h2>
      <p className="muted">
        {viewLabel(report.view)} view.{' '}
        <button type="button" className="link" onClick={onChangeView}>
          Change
        </button>
      </p>

      <div className="video-frame" style={{ aspectRatio: String(prepared.sequence.aspectRatio) }}>
        <video ref={videoRef} src={videoUrl} controls playsInline muted />
        <SkeletonOverlay sequence={prepared.sequence} videoRef={videoRef} />
      </div>

      <RepSignalChart
        signal={report.repSignal}
        reps={report.reps.map((r) => r.rep)}
        onSelectRep={seekTo}
      />

      {report.reps.length === 0 ? (
        <p>
          No full reps were found. Make sure the clip includes you at rest before the first rep and
          after the last, with your whole body in frame.
        </p>
      ) : (
        <ol className="rep-list">
          {report.reps.map(({ rep }) => (
            <li key={rep.index}>
              <button
                type="button"
                onClick={() => {
                  seekTo(rep);
                }}
              >
                Rep {rep.index + 1}
                <span className="muted">
                  {formatSeconds(rep.startFrame / report.sampleFps)} to{' '}
                  {formatSeconds(rep.endFrame / report.sampleFps)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <p className="muted">Form checks for each rep are coming next.</p>

      <div className="row">
        <button type="button" className="primary" onClick={onStartOver}>
          Analyse another set
        </button>
        <button
          type="button"
          onClick={() => {
            downloadJson(raw, `${report.liftId}-poses.json`);
          }}
        >
          Download pose data
        </button>
      </div>
    </div>
  );
}

function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(1)} s`;
}
