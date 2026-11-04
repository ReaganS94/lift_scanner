import { LANDMARK_COUNT, type Landmark, type PoseFrame, type PoseSequence } from '../core';
import { fillGaps, smooth, type Series } from './series';

export interface CleanPosesOptions {
  /** Points the model is less sure about than this are dropped before smoothing. */
  readonly minVisibility: number;
  /** Gaps up to this long, in seconds, are filled by interpolation. */
  readonly maxGapSeconds: number;
  /** Half-width of the smoothing window, in seconds. */
  readonly smoothingRadiusSeconds: number;
}

export const DEFAULT_CLEAN_POSES_OPTIONS: CleanPosesOptions = {
  minVisibility: 0.5,
  maxGapSeconds: 0.2,
  smoothingRadiusSeconds: 0.05,
};

/**
 * Prepares raw model output for measuring. For each landmark, low-confidence points are
 * dropped, short gaps are filled and jitter is smoothed out.
 *
 * A filled-in point gets a visibility of exactly `minVisibility`, so it counts as seen but is
 * marked as the least certain kind of point. A point that couldn't be recovered keeps its raw
 * position with a visibility of 0, so measuring code skips it.
 */
export function cleanPoses(
  sequence: PoseSequence,
  options: CleanPosesOptions = DEFAULT_CLEAN_POSES_OPTIONS,
): PoseSequence {
  const { frames, sampleFps } = sequence;
  const maxGap = Math.round(options.maxGapSeconds * sampleFps);
  const radius = Math.round(options.smoothingRadiusSeconds * sampleFps);

  const cleanedByLandmark = Array.from({ length: LANDMARK_COUNT }, (_, index) =>
    cleanLandmarkTrack(frames, index, options.minVisibility, maxGap, radius),
  );

  const cleanedFrames = frames.map((frame, frameIndex): PoseFrame => {
    const landmarks = cleanedByLandmark.map((track) => track[frameIndex]);
    const anySeen = landmarks.some((landmark) => landmark && landmark.visibility > 0);
    if (!anySeen) return { timeMs: frame.timeMs, landmarks: null };
    return {
      timeMs: frame.timeMs,
      landmarks: landmarks.map((landmark) => landmark ?? MISSING_LANDMARK),
    };
  });

  return { ...sequence, frames: cleanedFrames };
}

const MISSING_LANDMARK: Landmark = { x: 0, y: 0, z: 0, visibility: 0 };

/** Cleans one landmark across every frame. */
function cleanLandmarkTrack(
  frames: readonly PoseFrame[],
  index: number,
  minVisibility: number,
  maxGap: number,
  radius: number,
): (Landmark | undefined)[] {
  const raw = frames.map((frame) => frame.landmarks?.[index]);
  const seen = raw.map(
    (landmark) => landmark !== undefined && landmark.visibility >= minVisibility,
  );

  const axis = (pick: (landmark: Landmark) => number): Series =>
    raw.map((landmark, i) => (landmark && seen[i] ? pick(landmark) : null));
  const clean = (series: Series) => smooth(fillGaps(series, maxGap), radius);

  const xs = clean(axis((l) => l.x));
  const ys = clean(axis((l) => l.y));
  const zs = clean(axis((l) => l.z));

  return raw.map((landmark, i) => {
    const x = xs[i];
    const y = ys[i];
    const z = zs[i];
    if (x === null || x === undefined || y === null || y === undefined) {
      return landmark ? { ...landmark, visibility: 0 } : undefined;
    }
    const visibility = seen[i] && landmark ? landmark.visibility : minVisibility;
    return { x, y, z: z ?? landmark?.z ?? 0, visibility };
  });
}
