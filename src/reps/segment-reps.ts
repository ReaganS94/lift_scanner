import type { Rep, RepDetectionOptions } from '../core';
import { percentile, type Series } from '../signal';

/**
 * A rep starts when the signal climbs past ENTER of its typical peak, and ends when it falls
 * back below REST. The gap between the two (hysteresis) stops jitter near one threshold from
 * splitting a rep in two.
 */
const ENTER_FRACTION = 0.5;
const REST_FRACTION = 0.2;
/** The typical peak is taken as this percentile, so one bad frame can't set it. */
const PEAK_PERCENTILE = 0.95;

/**
 * Finds the reps in a rep signal (distance from rest, in torso lengths; see LiftDefinition).
 *
 * A rep only counts if the lifter is seen at rest both before and after it, so a set filmed
 * mid-rep doesn't produce a half rep. Frame indices refer to the signal, which has one value per
 * frame of the clip.
 */
export function segmentReps(
  signal: Series,
  sampleFps: number,
  options: RepDetectionOptions,
): Rep[] {
  const peak = percentile(signal, PEAK_PERCENTILE);
  if (peak === null || peak < options.minAmplitude) return [];

  const enterLevel = peak * ENTER_FRACTION;
  const restLevel = peak * REST_FRACTION;
  const minFrames = options.minDurationSeconds * sampleFps;

  const reps: Rep[] = [];
  let lastRestFrame: number | null = null;
  let repStart: number | null = null;

  signal.forEach((value, frame) => {
    if (value === null) return;

    if (repStart === null) {
      if (value <= restLevel) lastRestFrame = frame;
      else if (value >= enterLevel && lastRestFrame !== null) repStart = lastRestFrame;
      return;
    }

    if (value > restLevel) return;

    const turnFrame = indexOfMax(signal, repStart, frame);
    const turnValue = signal[turnFrame] ?? 0;
    if (frame - repStart >= minFrames && turnValue >= options.minAmplitude) {
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
