import { useEffect, useRef, useState } from 'react';
import type { PreparedClip } from '../../../analysis';
import {
  PHOTO_FRAME,
  type LiftPosition,
  type MeasuredCheckResult,
  type PoseSequence,
} from '../../../core';
import type { PhotoReport } from '../../../report';
import { downloadJson } from '../../download';
import { viewLabel } from '../../flow/analysis-flow';
import type { ShownPhoto } from '../../flow/photo-flow';
import { buzz } from '../../platform/haptics';
import { RepChecks } from '../results/RepChecks';
import { ResultCaption } from '../results/ResultCaption';
import { ResultsActions } from '../results/ResultsActions';
import type { SkeletonHighlight } from '../results/SkeletonOverlay';
import { PhotoSkeleton } from './PhotoSkeleton';

interface PhotoResultsProps {
  liftName: string;
  position: LiftPosition;
  photo: ShownPhoto;
  raw: PoseSequence;
  prepared: PreparedClip;
  report: PhotoReport;
  onChangeView: () => void;
  onStartOver: () => void;
}

/** How tall the photo may get, so the first results show under it on a phone. */
const PHOTO_MAX_HEIGHT = '55svh';

/**
 * A checked photo: the picture with the pose drawn on it, and a result for each of the
 * position's checks. Tapping a result highlights the joints it measured on the photo.
 */
export function PhotoResults({
  liftName,
  position,
  photo,
  raw,
  prepared,
  report,
  onChangeView,
  onStartOver,
}: PhotoResultsProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [focused, setFocused] = useState<MeasuredCheckResult | null>(null);
  const labels = new Map(position.checks.map((check) => [check.id, check.label]));
  const landmarks = prepared.sequence.frames[PHOTO_FRAME]?.landmarks ?? null;

  const fails = report.results.filter((result) => result.status === 'fail').length;
  const warns = report.results.filter((result) => result.status === 'warn').length;
  const measured = report.results.filter((result) => result.status !== 'skipped').length;
  useEffect(() => {
    buzz(fails > 0 ? [40, 80, 40] : 30);
  }, [fails]);

  const highlight: SkeletonHighlight | null = focused && {
    joints: new Set(position.checks.find((check) => check.id === focused.checkId)?.focus ?? []),
    status: focused.status,
  };

  return (
    <div className="stack">
      <h2>
        {liftName}: {position.name.toLowerCase()}
      </h2>
      <p className="verdict">{verdict(measured, warns, fails)}</p>
      <p className="muted">
        {viewLabel(report.view)} view{angleNote(report.correctedForDegrees)}.{' '}
        <button type="button" className="link" onClick={onChangeView}>
          Change
        </button>
      </p>

      <div
        className="photo-frame"
        style={{
          aspectRatio: String(photo.aspectRatio),
          width: `min(100%, calc(${PHOTO_MAX_HEIGHT} * ${String(photo.aspectRatio)}))`,
        }}
      >
        <img ref={imageRef} src={photo.url} alt={`Your ${liftName.toLowerCase()} photo`} />
        <PhotoSkeleton landmarks={landmarks} imageRef={imageRef} highlight={highlight} />
        {focused && (
          <ResultCaption result={focused} label={labels.get(focused.checkId) ?? focused.checkId} />
        )}
      </div>

      <section className="stack stack--tight">
        <h3>Checks</h3>
        <RepChecks
          results={report.results}
          labels={labels}
          onShowResult={(result) => {
            setFocused((current) => (current?.checkId === result.checkId ? null : result));
          }}
        />
        <p className="muted hint">Tap a result to see what it measured on the photo.</p>
      </section>

      <ResultsActions
        startOverLabel="Check another photo"
        onStartOver={onStartOver}
        onDownloadPoses={() => {
          downloadJson(raw, `${report.positionId}-pose.json`);
        }}
      />
    </div>
  );
}

function verdict(measured: number, warns: number, fails: number): string {
  if (measured === 0) return 'Nothing could be measured in this photo.';
  if (warns + fails === 0) return 'Every check passed.';
  const parts: string[] = [];
  if (fails > 0) parts.push(`${String(fails)} ${fails === 1 ? 'fail' : 'fails'}`);
  if (warns > 0) parts.push(`${String(warns)} ${warns === 1 ? 'warning' : 'warnings'}`);
  return `${parts.join(' and ')}.`;
}

/** As on the video results: small corrections aren't worth mentioning. */
const MENTION_ANGLE_FROM_DEGREES = 20;

function angleNote(degrees: number | undefined): string {
  if (degrees === undefined || degrees < MENTION_ANGLE_FROM_DEGREES) return '';
  return `, about ${String(Math.round(degrees))}° off side-on (angles corrected for it)`;
}
