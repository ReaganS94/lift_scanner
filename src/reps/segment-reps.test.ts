import { describe, expect, it } from 'vitest';
import { repWave } from '../testing/synthetic-pose';
import { REST_BAND, segmentReps } from './segment-reps';

const FPS = 30;
const OPTIONS = { minAmplitude: 0.3, minDurationSeconds: 0.5 };

describe('segmentReps', () => {
  it('finds each rep with its turning point in the middle', () => {
    const signal = repWave({ reps: 3, repFrames: 60, restFrames: 20, amplitude: 1 });
    const reps = segmentReps(signal, FPS, OPTIONS);

    expect(reps).toHaveLength(3);
    reps.forEach((rep, index) => {
      expect(rep.index).toBe(index);
      expect(rep.startFrame).toBeLessThan(rep.turnFrame);
      expect(rep.turnFrame).toBeLessThan(rep.endFrame);
      // Each rep peaks halfway through its 60 frames.
      expect(rep.turnFrame).toBe(20 + index * 80 + 30);
    });
  });

  it('finds a single rep in a long clip, such as a heavy single with a long setup', () => {
    const signal = repWave({ reps: 1, repFrames: 60, restFrames: 20 * FPS, amplitude: 1 });
    expect(segmentReps(signal, FPS, OPTIONS)).toHaveLength(1);
  });

  it('starts and ends each rep at rest, so the whole movement is inside it', () => {
    const signal = repWave({ reps: 2, repFrames: 60, restFrames: 20, amplitude: 1 });
    for (const rep of segmentReps(signal, FPS, OPTIONS)) {
      expect(signal[rep.startFrame]).toBeLessThanOrEqual(REST_BAND);
      expect(signal[rep.endFrame]).toBeLessThanOrEqual(REST_BAND);
      // The frame after the start is already moving: the start is the last frame at rest.
      expect(signal[rep.startFrame + 1]).toBeGreaterThan(signal[rep.startFrame] ?? Infinity);
    }
  });

  it('splits touch-and-go reps that never quite return to rest', () => {
    // Five reps that stop 0.12 torso lengths short of standing between them.
    const bouncing = repWave({ reps: 5, repFrames: 60, restFrames: 0, amplitude: 0.88 }).map(
      (value) => value + 0.12,
    );
    const rest = Array.from({ length: 20 }, () => 0);
    const reps = segmentReps([...rest, ...bouncing, ...rest], FPS, OPTIONS);

    expect(reps).toHaveLength(5);
    reps.forEach((rep, index) => {
      expect(rep.turnFrame).toBe(20 + index * 60 + 30);
    });
    // Each rep after the first starts where the one before it ended.
    for (let i = 1; i < reps.length; i++) {
      expect(reps[i]?.startFrame).toBe(reps[i - 1]?.endFrame);
    }
  });

  it('does not split a rep on a small wobble partway through', () => {
    // A dip of 0.1 (less than half the 0.3 minimum amplitude) on the way down.
    const wave: (number | null)[] = repWave({
      reps: 1,
      repFrames: 60,
      restFrames: 20,
      amplitude: 1,
    });
    for (let frame = 30; frame < 35; frame++) wave[frame] = (wave[frame] ?? 0) - 0.1;
    expect(segmentReps(wave, FPS, OPTIONS)).toHaveLength(1);
  });

  it('does not split a grinding rep that sinks back partway up', () => {
    // On the way back up the lifter sinks from 0.9 to 0.65, then grinds the rep out.
    const base = repWave({ reps: 1, repFrames: 90, restFrames: 20, amplitude: 1 });
    const sink = [
      0.85, 0.8, 0.75, 0.7, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65,
    ];
    const grind = [...base.slice(0, 70), ...sink, ...base.slice(70)];
    expect(segmentReps(grind, FPS, OPTIONS)).toHaveLength(1);
  });

  it('ignores movement smaller than the minimum amplitude', () => {
    const signal = repWave({ reps: 3, repFrames: 60, restFrames: 20, amplitude: 0.1 });
    expect(segmentReps(signal, FPS, OPTIONS)).toEqual([]);
  });

  it('ignores reps quicker than the minimum duration', () => {
    const signal = repWave({ reps: 2, repFrames: 8, restFrames: 20, amplitude: 1 });
    expect(segmentReps(signal, FPS, OPTIONS)).toEqual([]);
  });

  it('skips a rep already under way when the clip starts', () => {
    const wave = repWave({ reps: 2, repFrames: 60, restFrames: 20, amplitude: 1 });
    const startsMidRep = wave.slice(40); // begins 20 frames into the first rep
    expect(segmentReps(startsMidRep, FPS, OPTIONS)).toHaveLength(1);
  });

  it('skips a rep that is cut off at the end of the clip', () => {
    const wave = repWave({ reps: 2, repFrames: 60, restFrames: 20, amplitude: 1 });
    const endsMidRep = wave.slice(0, 20 + 80 + 30);
    expect(segmentReps(endsMidRep, FPS, OPTIONS)).toHaveLength(1);
  });

  it('counts a last rep that comes most of the way back down before the clip ends', () => {
    // A deadlift's last rep: the bar goes down but the lifter stands straight up from a
    // higher position than their set position, so the signal never gets back to rest.
    const wave = repWave({ reps: 2, repFrames: 60, restFrames: 20, amplitude: 1 });
    const lastRep = wave.slice(80, 80 + 70).map((value) => Math.max(value, 0.4));
    const standUp = Array.from({ length: 30 }, (_, i) => 0.4 + (0.6 * (i + 1)) / 30);
    const reps = segmentReps([...wave.slice(0, 80), ...lastRep, ...standUp], FPS, OPTIONS);
    expect(reps).toHaveLength(2);
    // It ends at its lowest point after lockout, before the lifter stands up.
    expect(reps[1]?.endFrame).toBeLessThan(80 + 70);
  });

  it('skips a last rep that only comes a little way down before the clip ends', () => {
    const wave = repWave({ reps: 2, repFrames: 60, restFrames: 20, amplitude: 1 });
    const endsNearTop = wave.slice(0, 20 + 80 + 38); // peak at 130, then down to about 0.8
    expect(segmentReps(endsNearTop, FPS, OPTIONS)).toHaveLength(1);
  });

  it('does not split a rep when the signal jitters near a threshold', () => {
    const wave = repWave({ reps: 1, repFrames: 60, restFrames: 20, amplitude: 1 });
    const jittery = wave.map((value, frame) => value + (frame % 2 === 0 ? 0.04 : -0.04));
    expect(segmentReps(jittery, FPS, OPTIONS)).toHaveLength(1);
  });

  it('bridges frames where the signal is missing', () => {
    const wave: (number | null)[] = repWave({
      reps: 1,
      repFrames: 60,
      restFrames: 20,
      amplitude: 1,
    });
    wave[50] = null;
    expect(segmentReps(wave, FPS, OPTIONS)).toHaveLength(1);
  });
});
