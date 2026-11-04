import type { Series } from './series';

/**
 * The value below which `fraction` of the measured values fall (0 = smallest, 1 = largest),
 * using linear interpolation between ranks. Missing values are ignored. Null if none remain.
 */
export function percentile(series: Series, fraction: number): number | null {
  const values = series.filter((value): value is number => value !== null).sort((a, b) => a - b);
  if (values.length === 0) return null;

  const rank = Math.min(1, Math.max(0, fraction)) * (values.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  const lowerValue = values[lower] ?? 0;
  const upperValue = values[upper] ?? lowerValue;
  return lowerValue + (upperValue - lowerValue) * (rank - lower);
}

export function median(series: Series): number | null {
  return percentile(series, 0.5);
}

/**
 * Each value replaced by the median of the measured values within `radius` frames of it. Unlike
 * an average, a single outlier can't move it, so a minimum taken afterwards reflects a value
 * that held for at least half the window rather than one noisy frame. Null where the value
 * itself is missing.
 */
export function rollingMedian(series: Series, radius: number): (number | null)[] {
  return series.map((value, index) =>
    value === null ? null : median(series.slice(Math.max(0, index - radius), index + radius + 1)),
  );
}
