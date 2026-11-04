import { describe, expect, it } from 'vitest';
import { repWave } from '../testing/synthetic-pose';
import { segmentReps } from './segment-reps';

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
