import type { Rep } from '../../core';

interface RepSignalChartProps {
  signal: readonly (number | null)[];
  reps: readonly Rep[];
  onSelectRep: (rep: Rep) => void;
}

const WIDTH = 300;
const HEIGHT = 80;

/**
 * The rep signal over the whole set, with each detected rep shaded and a caption saying what the
 * chart shows. Tap a rep to jump to it.
 */
export function RepSignalChart({ signal, reps, onSelectRep }: RepSignalChartProps) {
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
            className="rep-chart__rep"
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
      </svg>
      <figcaption className="muted">
        Your movement over the clip: the line rises as you move away from your rest position. Shaded
        areas are the reps found; tap one to play it. Gaps mean you weren&apos;t tracked there.
      </figcaption>
    </figure>
  );
}
