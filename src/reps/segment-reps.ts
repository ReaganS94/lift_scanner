import type { Rep, RepDetectionOptions } from '../core';
import type { Series } from '../signal';

/**
 * The rep signal is already measured in torso lengths from the rest position, so the
 * thresholds can be fixed distances rather than fractions of the set's own peak. That way a
 * single heavy rep in a long clip is found as reliably as a set of ten.
 *
 * A frame counts as "at rest" within this distance of the rest position: small enough that a
 * rep's start and end sit at the real start and end of the movement, large enough to absorb
 * the jitter left after smoothing.
 */
export const REST_BAND = 0.1;

/**
 * Finds the reps in a rep signal (distance from rest, in torso lengths; see LiftDefinition).
 *
 * A rep starts at the last frame at rest before the signal climbs past the lift's minimum
 * amplitude, and ends at the first frame back at rest. The gap between those two levels
 * (hysteresis) stops jitter near one of them from splitting a rep in two. A rep only counts if
 * the lifter is seen at rest both before and after it, so a clip that starts or ends mid-rep
 * doesn't produce a half rep. Frame indices refer to the signal, one value per frame of the clip.
 */
export function segmentReps(
  signal: Series,
  sampleFps: number,
  options: RepDetectionOptions,
): Rep[] {
  const minFrames = options.minDurationSeconds * sampleFps;
  const reps: Rep[] = [];
  let lastRestFrame: number | null = null;
  let repStart: number | null = null;

  signal.forEach((value, frame) => {
    if (value === null) return;

    if (repStart === null) {
      if (value <= REST_BAND) lastRestFrame = frame;
      else if (value >= options.minAmplitude && lastRestFrame !== null) repStart = lastRestFrame;
      return;
    }

    if (value > REST_BAND) return;

    if (frame - repStart >= minFrames) {
      const turnFrame = indexOfMax(signal, repStart, frame);
      reps.push({ index: reps.length, startFrame: repStart, turnFrame, endFrame: frame });
    }
    repStart = null;
    lastRestFrame = frame;
  });

  return reps;
}

function indexOfMax(signal: Series, from: number, to: number): number {
  let best = from;
  for (let i = from; i <= to; i++) {
    if ((signal[i] ?? -Infinity) > (signal[best] ?? -Infinity)) best = i;
  }
  return best;
}
