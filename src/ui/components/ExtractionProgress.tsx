interface ExtractionProgressProps {
  progress: number;
  onCancel: () => void;
}

/** Shown while the pose model works through the video. */
export function ExtractionProgress({ progress, onCancel }: ExtractionProgressProps) {
  const percent = Math.round(progress * 100);
  return (
    <div className="stack">
      <p>{percent === 0 ? 'Loading the pose model…' : `Tracking your movement… ${percent}%`}</p>
      <progress max={100} value={percent} aria-label="Analysis progress" />
      <p className="muted">This takes about as long as the video, sometimes longer.</p>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
