/**
 * Each lift's rep signal, fed a synthetic set, should rest near 0 and peak once per rep. This is
 * the contract the generic rep detector relies on (see LiftDefinition.repSignal).
 */
import { describe, expect, it } from 'vitest';
import type { ClipContext, LandmarkName, LiftDefinition } from '../core';
import { segmentReps } from '../reps';
import { moved, repWave, sequenceOf, standingFigure, UPPER_BODY } from '../testing/synthetic-pose';
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

  it('deadlift: bar rising from the floor', () => {
    // Start with the hands low (bar on the floor) and raise them each rep.
    const wave = repWave({ reps: 3, repFrames: 60, restFrames: 20, amplitude: 0.8 });
    const atFloor = moved(standingFigure('side'), HANDS, 0, 0.2);
    const sequence = sequenceOf(wave.map((amount) => moved(atFloor, HANDS, 0, -amount * TORSO)));
    expectThreeReps(
      deadlift,
      { sequence, view: 'side', torsoLength: TORSO, nearSide: 'left' },
      0.8,
    );
  });

  it('bench: bar lowering from lockout', () => {
    expectThreeReps(bench, setOf(HANDS, 1, 0.5), 0.5);
  });

  it('squat: a quarter-depth wobble is not a rep', () => {
    const signal = squat.repSignal(setOf(UPPER_BODY, 1, 0.1));
    expect(segmentReps(signal, 30, squat.repDetection)).toEqual([]);
  });
});
