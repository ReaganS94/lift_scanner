import type { Rep } from '../../../core';

interface RepSignalChartProps {
  signal: readonly (number | null)[];
  reps: readonly Rep[];
  /** The frame the video is showing, drawn as a playhead. */
  currentFrame: number;
  /** The rep to highlight, if any. */
  activeRepIndex: number | null;
  onSelectRep: (rep: Rep) => void;
}

const WIDTH = 300;
const HEIGHT = 80;

/**
 * The rep signal over the whole set, with each detected rep shaded and a caption saying what the
 * chart shows. A line follows the video, and the selected rep is highlighted. Tap a rep to play it.
 */
export function RepSignalChart({
  signal,
  reps,
  currentFrame,
  activeRepIndex,
  onSelectRep,
}: RepSignalChartProps) {
  const peak = Math.max(0.01, ...signal.map((value) => value ?? 0));
  const x = (frame: number) => (frame / Math.max(1, signal.length - 1)) * WIDTH;
  const y = (value: number) => HEIGHT - (value / peak) * (HEIGHT - 4) - 2;

  const path = signal
    .map((value, frame) =>
      value === null ? null : `${x(frame).toFixed(1)},${y(value).toFixed(1)}`,
    )
    .reduce<string[]>((segments, point, index) => {
      if (point === null) return segments;
      const startNew = index === 0 || signal[index - 1] === null;
      segments.push(`${startNew ? 'M' : 'L'}${point}`);
      return segments;
    }, [])
    .join(' ');

  return (
    <figure className="rep-chart-figure">
      <svg
        className="rep-chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Movement over the set, ${reps.length} reps found`}
      >
        {reps.map((rep) => (
          <rect
            key={rep.index}
            className={`rep-chart__rep${rep.index === activeRepIndex ? ' rep-chart__rep--active' : ''}`}
            x={x(rep.startFrame)}
            y={0}
            width={x(rep.endFrame) - x(rep.startFrame)}
            height={HEIGHT}
            onClick={() => {
              onSelectRep(rep);
            }}
          >
            <title>Rep {rep.index + 1}</title>
          </rect>
        ))}
        <path className="rep-chart__line" d={path} />
        <line
          className="rep-chart__playhead"
          x1={x(currentFrame)}
          x2={x(currentFrame)}
          y1={0}
          y2={HEIGHT}
        />
      </svg>
      <figcaption className="muted">
        Your movement over the clip: the line rises as you move away from your rest position. Shaded
        areas are the reps found; tap one to play it. Gaps mean you weren&apos;t tracked there.
      </figcaption>
    </figure>
  );
}
