import { useRef } from 'react';
import type { PreparedClip } from '../../analysis';
import type { PoseSequence, Rep } from '../../core';
import { liftRegistry } from '../../lifts';
import { summarize, type ReportSummary, type SetReport } from '../../report';
import { downloadJson } from '../download';
import { viewLabel } from '../flow/analysis-flow';
import { RepChecks } from './RepChecks';
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

/**
 * The analysed set: the video with the skeleton drawn over it, and each rep with its form
 * check results.
 */
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
  const checks = lift?.checks ?? [];
  const labels = new Map(checks.map((check) => [check.id, check.label]));
  // Checks that can't run from this view are named once, not repeated under every rep.
  const notForThisView = checks.filter((check) => !check.supportedViews.includes(report.view));
  const hiddenIds = new Set(notForThisView.map((check) => check.id));

  const playRep = (rep: Rep) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = rep.startFrame / report.sampleFps;
    void video.play();
  };

  const showFrame = (frameIndex: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = frameIndex / report.sampleFps;
  };

  return (
    <div className="stack">
      <h2>
        {lift?.name ?? report.liftId}: {summary.reps} {summary.reps === 1 ? 'rep' : 'reps'} found
      </h2>
      {summaryText(summary) && <p>{summaryText(summary)}</p>}
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
        onSelectRep={playRep}
      />

      {report.reps.length === 0 ? (
        <p>
          No full reps were found. Make sure the clip includes you at rest before the first rep and
          after the last, with your whole body in frame.
        </p>
      ) : (
        <ol className="rep-list">
          {report.reps.map(({ rep, results }) => (
            <li key={rep.index} className="rep-card">
              <button
                type="button"
                className="rep-card__header"
                onClick={() => {
                  playRep(rep);
                }}
              >
                Rep {rep.index + 1}
                <span className="muted">
                  {formatSeconds(rep.startFrame / report.sampleFps)} to{' '}
                  {formatSeconds(rep.endFrame / report.sampleFps)}
                </span>
              </button>
              <RepChecks
                results={results.filter((result) => !hiddenIds.has(result.checkId))}
                labels={labels}
                onShowFrame={showFrame}
              />
            </li>
          ))}
        </ol>
      )}

      {notForThisView.length > 0 && (
        <p className="muted">
          Not checked from this view:{' '}
          {notForThisView
            .map((check) => `${check.label} (needs ${check.supportedViews.join(' or ')})`)
            .join(', ')}
          .
        </p>
      )}

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

/** One line on how the set went, or null when nothing was measured. */
function summaryText({ pass, warn, fail }: ReportSummary): string | null {
  if (pass + warn + fail === 0) return null;
  if (warn + fail === 0) return 'Every check passed.';
  const parts: string[] = [];
  if (fail > 0) parts.push(`${String(fail)} ${fail === 1 ? 'fail' : 'fails'}`);
  if (warn > 0) parts.push(`${String(warn)} ${warn === 1 ? 'warning' : 'warnings'}`);
  return `${parts.join(' and ')} across the set.`;
}

function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(1)} s`;
}
