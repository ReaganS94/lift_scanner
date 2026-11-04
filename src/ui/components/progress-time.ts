/** Below this much progress, a time estimate swings too much to be worth showing. */
const MIN_PROGRESS_FOR_ESTIMATE = 0.05;

/**
 * Seconds left, assuming the rest goes at the same pace as `elapsedSeconds` of tracking so
 * far. Null until there's enough progress to guess from.
 */
export function estimateRemainingSeconds(elapsedSeconds: number, progress: number): number | null {
  if (progress < MIN_PROGRESS_FOR_ESTIMATE || progress >= 1) return null;
  return (elapsedSeconds * (1 - progress)) / progress;
}

/** A short duration for people, e.g. "45 s" or "2 min 05 s". */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  if (whole < 60) return `${String(whole)} s`;
  const minutes = Math.floor(whole / 60);
  const rest = String(whole % 60).padStart(2, '0');
  return `${String(minutes)} min ${rest} s`;
}
