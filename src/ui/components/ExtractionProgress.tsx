import { useEffect, useState } from 'react';
import { useWakeLock } from '../platform/use-wake-lock';
import { estimateRemainingSeconds, formatDuration } from './progress-time';

interface ExtractionProgressProps {
  progress: number;
  onCancel: () => void;
}

/**
 * Shown while the pose model works through the video. Keeps the screen on, and shows how long
 * it has taken and roughly how long is left.
 */
export function ExtractionProgress({ progress, onCancel }: ExtractionProgressProps) {
  useWakeLock(true);
  const percent = Math.round(progress * 100);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  // Timed from the first tracked frame, so loading the model doesn't skew the estimate.
  const [trackingStartedAt, setTrackingStartedAt] = useState<number | null>(null);
  if (progress > 0 && trackingStartedAt === null) setTrackingStartedAt(now);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  const trackingSeconds = trackingStartedAt === null ? 0 : (now - trackingStartedAt) / 1000;
  const remaining = estimateRemainingSeconds(trackingSeconds, progress);

  return (
    <div className="stack">
      <p>{percent === 0 ? 'Loading the pose model…' : `Tracking your movement… ${percent}%`}</p>
      <progress max={100} value={percent} aria-label="Analysis progress" />
      <p className="muted progress-times">
        <span>{formatDuration((now - startedAt) / 1000)} so far</span>
        {remaining !== null && <span>About {formatDuration(remaining)} left</span>}
      </p>
      <p className="muted">
        This takes about as long as the video, sometimes longer. Keep the app open: the screen stays
        on until it&apos;s done.
      </p>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
