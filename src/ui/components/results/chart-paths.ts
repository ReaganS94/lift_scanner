/** SVG path data for a signal with gaps: the line itself, and the area under it. */
export interface SignalPaths {
  readonly line: string;
  readonly area: string;
}

/**
 * Builds the line through every non-null value, breaking it at gaps, and an area that closes
 * each unbroken run down to `baseline`.
 */
export function signalPaths(
  signal: readonly (number | null)[],
  x: (frame: number) => number,
  y: (value: number) => number,
  baseline: number,
): SignalPaths {
  const runs: { frame: number; value: number }[][] = [];
  signal.forEach((value, frame) => {
    if (value === null) return;
    if (frame === 0 || signal[frame - 1] === null || runs.length === 0) runs.push([]);
    runs[runs.length - 1]?.push({ frame, value });
  });

  const point = ({ frame, value }: { frame: number; value: number }) =>
    `${x(frame).toFixed(1)},${y(value).toFixed(1)}`;
  const lines = runs.map((run) => run.map((p, i) => `${i === 0 ? 'M' : 'L'}${point(p)}`).join(' '));
  const areas = runs.map((run, i) => {
    const first = run[0];
    const last = run[run.length - 1];
    if (!first || !last) return '';
    const base = baseline.toFixed(1);
    return `${lines[i] ?? ''} L${x(last.frame).toFixed(1)},${base} L${x(first.frame).toFixed(1)},${base} Z`;
  });
  return { line: lines.join(' '), area: areas.join(' ') };
}
