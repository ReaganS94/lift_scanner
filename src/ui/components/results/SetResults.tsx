import { useEffect, useRef, useState } from 'react';
import type { PreparedClip } from '../../../analysis';
import type { PoseSequence } from '../../../core';
import { liftRegistry } from '../../../lifts';
import { summarize, summarizeByCheck, type ReportSummary, type SetReport } from '../../../report';
import { downloadJson } from '../../download';
import { viewLabel } from '../../flow/analysis-flow';
import { repAtFrame } from '../../playback/frames';
import { buzz } from '../../platform/haptics';
import { usePlayback } from '../../playback/use-playback';
import { CheckSummaryList } from './CheckSummaryList';
import { PlaybackControls } from './PlaybackControls';
import { RepDetail } from './RepDetail';
import { RepGrid } from './RepGrid';
import { RepSignalChart } from './RepSignalChart';
import { ResultsActions } from './ResultsActions';
import { SkeletonOverlay } from './SkeletonOverlay';

interface SetResultsProps {
  videoUrl: string;
  raw: PoseSequence;
  prepared: PreparedClip;
  report: SetReport;
  onChangeView: () => void;
  onStartOver: () => void;
}

/** How tall the pinned video may get, so the results stay visible under it on a phone. */
const VIDEO_MAX_HEIGHT = '42svh';

/**
 * The analysed set. The video stays pinned at the top while the results scroll under it, so
 * tapping any result shows its moment straight away. Below it: the set at a glance per check,
 * a grid of every rep against every check, and the selected rep in full.
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
  const [selectedRepIndex, setSelectedRepIndex] = useState<number | null>(
    report.reps.length > 0 ? 0 : null,
  );
  const [looping, setLooping] = useState(false);

  const { sequence } = prepared;
  const reps = report.reps.map((repReport) => repReport.rep);
  const selected = report.reps.find(({ rep }) => rep.index === selectedRepIndex);
  const playback = usePlayback(videoRef, {
    sampleFps: report.sampleFps,
    frameCount: sequence.frames.length,
    loop: looping && selected ? selected.rep : null,
  });

  const lift = liftRegistry.get(report.liftId);
  const summary = summarize(report);
  const checks = lift?.checks ?? [];
  const labels = new Map(checks.map((check) => [check.id, check.label]));
  // Checks that can't run from this view are named once, not shown for every rep.
  const shownChecks = checks.filter((check) => check.supportedViews.includes(report.view));
  const notForThisView = checks.filter((check) => !check.supportedViews.includes(report.view));
  const hiddenIds = new Set(notForThisView.map((check) => check.id));
  const checkSummaries = summarizeByCheck(
    report,
    shownChecks.map((check) => check.id),
  );
  // A buzz when the results arrive: a double one if anything failed.
  const hasFails = summary.fail > 0;
  useEffect(() => {
    buzz(hasFails ? [40, 80, 40] : 30);
  }, [hasFails]);

  const playingRep = playback.playing ? repAtFrame(reps, playback.frame) : undefined;

  const showResult = (repIndex: number, frameIndex: number | undefined) => {
    const repReport = report.reps.find(({ rep }) => rep.index === repIndex);
    if (!repReport) return;
    setSelectedRepIndex(repIndex);
    playback.showFrame(frameIndex ?? repReport.rep.startFrame);
  };

  return (
    <div className="stack">
      <h2>
        {lift?.name ?? report.liftId}: {summary.reps} {summary.reps === 1 ? 'rep' : 'reps'} found
      </h2>
      {summaryText(summary) && <p className="verdict">{summaryText(summary)}</p>}
      <p className="muted">
        {viewLabel(report.view)} view.{' '}
        <button type="button" className="link" onClick={onChangeView}>
          Change
        </button>
      </p>

      <div className="player">
        <div
          className="video-frame"
          style={{
            aspectRatio: String(sequence.aspectRatio),
            width: `min(100%, calc(${VIDEO_MAX_HEIGHT} * ${String(sequence.aspectRatio)}))`,
          }}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            playsInline
            muted
            preload="auto"
            onClick={playback.togglePlay}
          />
          <SkeletonOverlay sequence={sequence} videoRef={videoRef} />
        </div>
        <PlaybackControls
          playback={playback}
          sampleFps={report.sampleFps}
          frameCount={sequence.frames.length}
          loopRepNumber={selected ? selected.rep.index + 1 : null}
          looping={looping}
          onToggleLoop={() => {
            setLooping((on) => !on);
          }}
        />
      </div>

      <RepSignalChart
        signal={report.repSignal}
        reps={reps}
        currentFrame={playback.frame}
        activeRepIndex={playingRep?.index ?? selectedRepIndex}
        onSelectRep={(rep) => {
          setSelectedRepIndex(rep.index);
          playback.playFrom(rep);
        }}
      />

      {report.reps.length === 0 ? (
        <p>
          No full reps were found. Make sure the clip includes you at rest before the first rep and
          after the last, with your whole body in frame.
        </p>
      ) : (
        <>
          {checkSummaries.length > 0 && (
            <section className="stack stack--tight">
              <h3>Checks</h3>
              <CheckSummaryList
                summaries={checkSummaries}
                labels={labels}
                onShowResult={showResult}
              />
            </section>
          )}

          <section className="stack stack--tight">
            <h3>Rep by rep</h3>
            {shownChecks.length > 0 && (
              <RepGrid
                reps={report.reps}
                checks={shownChecks}
                selectedRepIndex={selectedRepIndex}
                onShowResult={showResult}
              />
            )}
            {selected && (
              <RepDetail
                repReport={selected}
                sampleFps={report.sampleFps}
                hiddenCheckIds={hiddenIds}
                labels={labels}
                onPlay={() => {
                  playback.playFrom(selected.rep);
                }}
                onShowFrame={playback.showFrame}
              />
            )}
          </section>
        </>
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

      <ResultsActions
        onStartOver={onStartOver}
        onDownloadPoses={() => {
          downloadJson(raw, `${report.liftId}-poses.json`);
        }}
      />
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
