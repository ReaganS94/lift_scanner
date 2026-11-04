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
 * doesn't produce a half rep.
 *
 * Touch-and-go reps don't return fully to rest between reps, so a rep also ends at a bounce: a
 * dip below the minimum amplitude (close to rest) that is at least half the minimum amplitude
 * below the rep's peak, followed by a climb of at least as much that passes the minimum
 * amplitude again. The next rep starts at that dip. Smaller wobbles, and a grinding rep that
 * sinks back partway through but never gets near rest, don't split a rep.
 *
 * Frame indices refer to the signal, one value per frame of the clip.
 */
export function segmentReps(
  signal: Series,
  sampleFps: number,
  options: RepDetectionOptions,
): Rep[] {
  const minFrames = options.minDurationSeconds * sampleFps;
  const bounce = options.minAmplitude / 2;
  const reps: Rep[] = [];

  const addRep = (startFrame: number, endFrame: number) => {
    if (endFrame - startFrame < minFrames) return;
    const turnFrame = indexOfMax(signal, startFrame, endFrame);
    reps.push({ index: reps.length, startFrame, turnFrame, endFrame });
  };

  let lastRestFrame: number | null = null;
  let rep: OpenRep | null = null;

  signal.forEach((value, frame) => {
    if (value === null) return;

    if (rep === null) {
      if (value <= REST_BAND) lastRestFrame = frame;
      else if (value >= options.minAmplitude && lastRestFrame !== null) {
        rep = { startFrame: lastRestFrame, peak: value, dip: null };
      }
      return;
    }

    if (value <= REST_BAND) {
      addRep(rep.startFrame, frame);
      rep = null;
      lastRestFrame = frame;
      return;
    }

    if (rep.dip === null) {
      if (value > rep.peak) rep.peak = value;
      else if (rep.peak - value >= bounce) rep.dip = { value, frame };
      return;
    }

    if (value < rep.dip.value) {
      rep.dip = { value, frame };
    } else if (
      rep.dip.value < options.minAmplitude &&
      value >= options.minAmplitude &&
      value - rep.dip.value >= bounce
    ) {
      addRep(rep.startFrame, rep.dip.frame);
      rep = { startFrame: rep.dip.frame, peak: value, dip: null };
    }
  });

  return reps;
}

/** A rep that has started but not yet ended. */
interface OpenRep {
  readonly startFrame: number;
  /** The highest value since the rep started. */
  peak: number;
  /** The lowest point since the signal dropped well below the peak: a possible bounce. */
  dip: { readonly value: number; readonly frame: number } | null;
}

function indexOfMax(signal: Series, from: number, to: number): number {
  let best = from;
  for (let i = from; i <= to; i++) {
    if ((signal[i] ?? -Infinity) > (signal[best] ?? -Infinity)) best = i;
  }
  return best;
}
