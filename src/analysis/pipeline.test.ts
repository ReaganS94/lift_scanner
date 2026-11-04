import { describe, expect, it } from 'vitest';
import type {
  FormCheck,
  FrameSource,
  Landmark,
  LiftDefinition,
  PoseEstimator,
  SampledFrame,
} from '../core';
import { squat } from '../lifts/squat';
import {
  moved,
  PORTRAIT_ASPECT,
  repWave,
  standingFigure,
  UPPER_BODY,
} from '../testing/synthetic-pose';
import { analyzeSet } from './analyze-set';
import { ExtractionCancelledError, extractPoses } from './extract-poses';
import { prepareClip } from './prepare-clip';

const FPS = 30;
const TORSO = 0.25;

/** A fake video whose "image" for each frame is simply the landmarks to report. */
function fakeVideo(figures: readonly Landmark[][]): FrameSource<Landmark[]> {
  return {
    durationMs: (figures.length * 1000) / FPS,
    aspectRatio: PORTRAIT_ASPECT,
    async *frames(sampleFps: number) {
      for (const [index, image] of figures.entries()) {
        await Promise.resolve();
        yield { timeMs: (index * 1000) / sampleFps, image };
      }
    },
  };
}

const fakeEstimator: PoseEstimator<Landmark[]> = {
  init: () => Promise.resolve(),
  estimate: (frame: SampledFrame<Landmark[]>) =>
    Promise.resolve({ timeMs: frame.timeMs, landmarks: frame.image }),
  dispose: () => undefined,
};

function squatSet(reps: number): Landmark[][] {
  return repWave({ reps, repFrames: 60, restFrames: 20, amplitude: 0.9 }).map((amount) =>
    moved(standingFigure('side'), UPPER_BODY, 0, amount * TORSO),
  );
}

const sideOnly: FormCheck = {
  id: 'side-only',
  label: 'Side only',
  supportedViews: ['side'],
  evaluate: ({ rep }) => ({
    checkId: 'side-only',
    status: 'pass',
    message: 'ok',
    frameIndex: rep.turnFrame,
  }),
};
const frontOnly: FormCheck = { ...sideOnly, id: 'front-only', supportedViews: ['front'] };
const squatWithChecks: LiftDefinition = { ...squat, checks: [sideOnly, frontOnly] };

describe('pipeline', () => {
  it('goes from video frames to a rep-by-rep report', async () => {
    const progress: number[] = [];
    const raw = await extractPoses(fakeVideo(squatSet(3)), fakeEstimator, {
      sampleFps: FPS,
      onProgress: (fraction) => progress.push(fraction),
    });
    expect(progress.at(-1)).toBe(1);

    const prepared = prepareClip(raw);
    expect(prepared.viewGuess.view).toBe('side');
    expect(prepared.torsoLength).toBeCloseTo(TORSO);

    const report = analyzeSet(
      {
        sequence: prepared.sequence,
        view: 'side',
        torsoLength: prepared.torsoLength ?? 0,
        nearSide: prepared.nearSide,
      },
      squatWithChecks,
    );

    expect(report.reps).toHaveLength(3);
    for (const { rep, results } of report.reps) {
      expect(results).toEqual([
        { checkId: 'side-only', status: 'pass', message: 'ok', frameIndex: rep.turnFrame },
        { checkId: 'front-only', status: 'skipped', message: 'Needs a front view.' },
      ]);
    }
  });

  it('can be cancelled part-way through extraction', async () => {
    let calls = 0;
    const extraction = extractPoses(fakeVideo(squatSet(1)), fakeEstimator, {
      sampleFps: FPS,
      isCancelled: () => ++calls > 5,
    });
    await expect(extraction).rejects.toBeInstanceOf(ExtractionCancelledError);
  });
});
