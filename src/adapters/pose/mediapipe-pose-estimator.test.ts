import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaPipePoseEstimator } from './mediapipe-pose-estimator';

interface CreateOptions {
  readonly baseOptions: { readonly delegate: string };
  readonly runningMode: string;
}

const mediapipe = vi.hoisted(() => ({
  forVisionTasks: vi.fn<(wasmBaseUrl: string) => Promise<unknown>>(),
  createFromOptions: vi.fn<(fileset: unknown, options: CreateOptions) => Promise<unknown>>(),
}));

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: mediapipe.forVisionTasks },
  PoseLandmarker: { createFromOptions: mediapipe.createFromOptions },
}));

const IMAGE = {} as TexImageSource;

/** One landmark is enough to tell people apart in these tests. */
const person = (x: number) => [{ x, y: 0.5, z: 0, visibility: 1 }];

function fakeLandmarker() {
  return {
    close: vi.fn<() => void>(),
    detect: vi.fn<(image: unknown) => { landmarks: unknown[] }>(() => ({ landmarks: [] })),
    detectForVideo: vi.fn<(image: unknown, timestampMs: number) => { landmarks: unknown[] }>(
      () => ({ landmarks: [] }),
    ),
  };
}

/** A tracker and a finder, created in that order by each model load. */
function fakeModels() {
  const tracker = fakeLandmarker();
  const finder = fakeLandmarker();
  mediapipe.createFromOptions.mockImplementation((_, options) =>
    Promise.resolve(options.runningMode === 'VIDEO' ? tracker : finder),
  );
  return { tracker, finder };
}

function newEstimator(): MediaPipePoseEstimator {
  return new MediaPipePoseEstimator({ wasmBaseUrl: '/wasm' });
}

/** The delegate of each model load (each load creates a tracker, then a finder). */
function delegatesTried(): string[] {
  return mediapipe.createFromOptions.mock.calls
    .filter(([, options]) => options.runningMode === 'VIDEO')
    .map(([, options]) => options.baseOptions.delegate);
}

beforeEach(() => {
  mediapipe.forVisionTasks.mockReset().mockResolvedValue({});
  mediapipe.createFromOptions.mockReset();
});

describe('MediaPipePoseEstimator', () => {
  it('shares one model load between overlapping init calls', async () => {
    // A run cancelled while the model loads, then a new run, calls init() twice.
    fakeModels();
    const estimator = newEstimator();
    await Promise.all([estimator.init(), estimator.init()]);
    expect(mediapipe.createFromOptions).toHaveBeenCalledTimes(2);
  });

  it('tries again on the next init after a failed load', async () => {
    mediapipe.forVisionTasks.mockRejectedValueOnce(new Error('offline'));
    fakeModels();
    const estimator = newEstimator();
    await expect(estimator.init()).rejects.toThrow('offline');
    await estimator.init();
    expect(delegatesTried()).toEqual(['GPU']);
  });

  it('falls back to the CPU when the GPU model fails to start', async () => {
    mediapipe.createFromOptions
      .mockRejectedValueOnce(new Error('no WebGL'))
      .mockResolvedValue(fakeLandmarker());
    await newEstimator().init();
    expect(delegatesTried()).toEqual(['GPU', 'CPU']);
  });

  it('closes the tracker when the finder fails to start', async () => {
    const tracker = fakeLandmarker();
    mediapipe.createFromOptions
      .mockResolvedValueOnce(tracker)
      .mockRejectedValueOnce(new Error('out of memory'))
      .mockResolvedValue(fakeLandmarker());
    await newEstimator().init();
    expect(tracker.close).toHaveBeenCalled();
    expect(delegatesTried()).toEqual(['GPU', 'CPU']);
  });

  it('switches to the CPU when the GPU fails on the first frame', async () => {
    const gpuTracker = fakeLandmarker();
    gpuTracker.detectForVideo.mockImplementation(() => {
      throw new Error('GPU lost');
    });
    const gpuFinder = fakeLandmarker();
    const cpuTracker = fakeLandmarker();
    cpuTracker.detectForVideo.mockReturnValue({ landmarks: [person(0.5)] });
    mediapipe.createFromOptions
      .mockResolvedValueOnce(gpuTracker)
      .mockResolvedValueOnce(gpuFinder)
      .mockResolvedValueOnce(cpuTracker)
      .mockResolvedValueOnce(fakeLandmarker());
    const estimator = newEstimator();
    await estimator.init();

    const pose = await estimator.estimate({ timeMs: 0, image: IMAGE }, 1);
    expect(pose.landmarks).not.toBeNull();
    expect(gpuTracker.close).toHaveBeenCalled();
    expect(gpuFinder.close).toHaveBeenCalled();
    expect(delegatesTried()).toEqual(['GPU', 'CPU']);
  });

  it('closes a model that finishes loading after dispose', async () => {
    const landmarker = fakeLandmarker();
    let finishLoading: (value: unknown) => void = () => undefined;
    mediapipe.createFromOptions.mockReturnValue(
      new Promise((resolve) => {
        finishLoading = resolve;
      }),
    );
    const estimator = newEstimator();
    const loading = estimator.init();
    estimator.dispose();
    finishLoading(landmarker);

    await expect(loading).rejects.toThrow('released');
    expect(landmarker.close).toHaveBeenCalled();
  });

  it('keeps a newer load when an older one is released and fails late', async () => {
    let finishFirstLoad: (value: unknown) => void = () => undefined;
    mediapipe.createFromOptions
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishFirstLoad = resolve;
        }),
      )
      .mockResolvedValue(fakeLandmarker());
    const estimator = newEstimator();

    const first = estimator.init();
    estimator.dispose();
    await estimator.init();
    finishFirstLoad(fakeLandmarker());
    await expect(first).rejects.toThrow('released');

    // The second load is still the shared one, so another init() doesn't start a third.
    await estimator.init();
    expect(delegatesTried()).toHaveLength(2);
  });

  it('keeps timestamps increasing when the next clip starts again at 0', async () => {
    const { tracker } = fakeModels();
    const estimator = newEstimator();
    await estimator.init();

    for (const timeMs of [0, 33, 0, 33]) await estimator.estimate({ timeMs, image: IMAGE }, 1);
    const timestamps = tracker.detectForVideo.mock.calls.map(([, timestampMs]) => timestampMs);
    expect(timestamps).toEqual([0, 33, 34, 67]);
  });

  it('adds everyone the finder sees, every fifth frame of each clip', async () => {
    const { tracker, finder } = fakeModels();
    tracker.detectForVideo.mockReturnValue({ landmarks: [person(0.5)] });
    finder.detect.mockReturnValue({ landmarks: [person(0.5), person(0.25)] });
    const estimator = newEstimator();
    await estimator.init();

    const peopleCounts = [];
    for (const timeMs of [0, 33, 67, 100, 133, 167, 0]) {
      const pose = await estimator.estimate({ timeMs, image: IMAGE }, 0.5);
      peopleCounts.push(pose.people?.length);
    }
    // The tracked person first, then the finder's (repeats are dropped later, by linkPeople).
    expect(peopleCounts).toEqual([3, 1, 1, 1, 1, 3, 3]);
    const first = await estimator.estimate({ timeMs: 33, image: IMAGE }, 0.5);
    expect(first.landmarks?.[0]?.x).toBe(0.25);
  });

  it('finds everyone in a photo with the finder alone, leaving the tracker untouched', async () => {
    const { tracker, finder } = fakeModels();
    finder.detect.mockReturnValue({ landmarks: [person(0.5), person(0.25)] });
    const estimator = newEstimator();
    await estimator.init();

    const pose = await estimator.estimateStill(IMAGE, 0.5);
    expect(pose.people).toHaveLength(2);
    expect(pose.landmarks?.[0]?.x).toBe(0.25);
    expect(tracker.detectForVideo).not.toHaveBeenCalled();

    // A clip afterwards still starts its timestamps at 0.
    await estimator.estimate({ timeMs: 0, image: IMAGE }, 0.5);
    expect(tracker.detectForVideo.mock.calls.map(([, timestampMs]) => timestampMs)).toEqual([0]);
  });
});
