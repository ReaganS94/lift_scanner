/**
 * Each lift's rep signal, fed a synthetic set, should rest near 0 and peak once per rep. This is
 * the contract the generic rep detector relies on (see LiftDefinition.repSignal).
 */
import { describe, expect, it } from 'vitest';
import type { ClipContext, Landmark, LandmarkName, LiftDefinition } from '../core';
import { segmentReps } from '../reps';
import {
  moved,
  repWave,
  sequenceOf,
  setVisibility,
  standingFigure,
  UPPER_BODY,
} from '../testing/synthetic-pose';
import { bench } from './bench';
import { deadlift } from './deadlift';
import { squat } from './squat';

const TORSO = 0.25; // shoulder-to-hip distance in the synthetic figure
const HANDS: readonly LandmarkName[] = ['leftWrist', 'rightWrist'];

/** A three-rep set where the named landmarks move by `wave * TORSO * direction` in y. */
function setOf(names: readonly LandmarkName[], direction: 1 | -1, amplitude: number): ClipContext {
  const wave = repWave({ reps: 3, repFrames: 60, restFrames: 20, amplitude });
  const sequence = sequenceOf(
    wave.map((amount) => moved(standingFigure('side'), names, 0, direction * amount * TORSO)),
  );
  return { sequence, view: 'side', torsoLength: TORSO, nearSide: 'left' };
}

function expectThreeReps(lift: LiftDefinition, clip: ClipContext, amplitude: number) {
  const signal = lift.repSignal(clip);
  expect(signal[0]).toBeCloseTo(0);
  expect(Math.max(...signal.map((v) => v ?? 0))).toBeCloseTo(amplitude);
  expect(segmentReps(signal, clip.sequence.sampleFps, lift.repDetection)).toHaveLength(3);
}

describe('rep signals', () => {
  it('squat: hips dropping from standing', () => {
    // The upper body sinks with the hips.
    expectThreeReps(squat, setOf(UPPER_BODY, 1, 0.9), 0.9);
  });

  it('deadlift: shoulders rising from the floor', () => {
    // Start bent over the bar (shoulders low) and stand up each rep. The hands are hidden
    // throughout, as they are behind the plates when filmed from the side.
    const wave = repWave({ reps: 3, repFrames: 60, restFrames: 20, amplitude: 0.9 });
    const atFloor = moved(standingFigure('side'), UPPER_BODY, 0, 0.9 * TORSO);
    const sequence = sequenceOf(
      wave.map((amount) => withHandsHidden(moved(atFloor, UPPER_BODY, 0, -amount * TORSO))),
    );
    expectThreeReps(
      deadlift,
      { sequence, view: 'side', torsoLength: TORSO, nearSide: 'left' },
      0.9,
    );
  });

  it('deadlift: a heavy single with standing around before and after', () => {
    // Stands for 10 s, bends to the bar, one 2 s pull, back to the floor, stands up again.
    // Standing has the shoulders as high as lockout, but no rest comes before the first
    // standing period or after the last, so only the pull counts.
    const standing = standingFigure('side');
    const atFloor = moved(standing, UPPER_BODY, 0, 0.9 * TORSO);
    const pull = repWave({ reps: 1, repFrames: 60, restFrames: 45, amplitude: 0.9 });
    const frames = [
      ...Array.from({ length: 300 }, () => standing),
      ...pull.map((amount) => moved(atFloor, UPPER_BODY, 0, -amount * TORSO)),
      ...Array.from({ length: 300 }, () => standing),
    ];
    const clip: ClipContext = {
      sequence: sequenceOf(frames),
      view: 'side',
      torsoLength: TORSO,
      nearSide: 'left',
    };
    expect(segmentReps(deadlift.repSignal(clip), 30, deadlift.repDetection)).toHaveLength(1);
  });

  it('bench: bar lowering from lockout', () => {
    expectThreeReps(bench, setOf(HANDS, 1, 0.5), 0.5);
  });

  it('squat: a quarter-depth wobble is not a rep', () => {
    const signal = squat.repSignal(setOf(UPPER_BODY, 1, 0.1));
    expect(segmentReps(signal, 30, squat.repDetection)).toEqual([]);
  });
});

function withHandsHidden(landmarks: Landmark[]): Landmark[] {
  for (const name of HANDS) setVisibility(landmarks, name, 0);
  return landmarks;
}
