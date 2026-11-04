import { useId } from 'react';
import type { CheckStatus, Rep } from '../../../core';
import { signalPaths } from './chart-paths';

/** A result to mark on the chart where it was measured. */
export interface ChartMarker {
  readonly frame: number;
  readonly status: CheckStatus;
}

interface RepSignalChartProps {
  signal: readonly (number | null)[];
  reps: readonly Rep[];
  /** Warnings and fails, marked on the line. */
  markers: readonly ChartMarker[];
  /** The frame the video is showing, drawn as a playhead. */
  currentFrame: number;
  /** The rep to highlight, if any. */
  activeRepIndex: number | null;
  onSelectRep: (rep: Rep) => void;
}

const WIDTH = 300;
const HEIGHT = 80;
const TOP = 14;

/**
 * The rep signal over the whole set, with each detected rep shaded and numbered, warnings and
 * fails marked, and a playhead that follows the video. Tap a rep to play it.
 */
export function RepSignalChart({
  signal,
  reps,
  markers,
  currentFrame,
  activeRepIndex,
  onSelectRep,
}: RepSignalChartProps) {
  const gradientId = useId();
  const peak = Math.max(0.01, ...signal.map((value) => value ?? 0));
  const x = (frame: number) => (frame / Math.max(1, signal.length - 1)) * WIDTH;
  const y = (value: number) => HEIGHT - (value / peak) * (HEIGHT - TOP - 4) - 2;
  const { line, area } = signalPaths(signal, x, y, HEIGHT);

  return (
    <figure className="rep-chart-figure">
      <svg
        className="rep-chart"
        viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
        role="img"
        aria-label={`Movement over the set, ${String(reps.length)} reps found`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="rep-chart__fill-top" />
            <stop offset="100%" className="rep-chart__fill-bottom" />
          </linearGradient>
        </defs>
        {reps.map((rep) => (
          <g
            key={rep.index}
            className={`rep-chart__rep${rep.index === activeRepIndex ? ' rep-chart__rep--active' : ''}`}
            onClick={() => {
              onSelectRep(rep);
            }}
          >
            <title>Rep {rep.index + 1}</title>
            <rect
              className="rep-chart__band"
              x={x(rep.startFrame)}
              y={0}
              width={x(rep.endFrame) - x(rep.startFrame)}
              height={HEIGHT}
            />
            <text
              className="rep-chart__label"
              x={(x(rep.startFrame) + x(rep.endFrame)) / 2}
              y={10}
              textAnchor="middle"
            >
              {rep.index + 1}
            </text>
          </g>
        ))}
        <path className="rep-chart__area" d={area} fill={`url(#${gradientId})`} />
        <path className="rep-chart__line" d={line} />
        {markers.map((marker) => {
          const value = signal[marker.frame];
          if (value === null || value === undefined) return null;
          return (
            <circle
              key={`${String(marker.frame)}-${marker.status}`}
              className={`rep-chart__marker rep-chart__marker--${marker.status}`}
              cx={x(marker.frame)}
              cy={y(value)}
              r={3.5}
            />
          );
        })}
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
        areas are the reps found; tap one to play it. Dots mark warnings and fails. Gaps mean you
        weren&apos;t tracked there.
      </figcaption>
    </figure>
  );
}
