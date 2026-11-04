import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaPipePoseEstimator } from './mediapipe-pose-estimator';

interface CreateOptions {
  readonly baseOptions: { readonly delegate: string };
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

function fakeLandmarker() {
  return {
    close: vi.fn<() => void>(),
    detectForVideo: vi.fn<(image: unknown, timestampMs: number) => { landmarks: unknown[] }>(
      () => ({ landmarks: [] }),
    ),
  };
}

function newEstimator(): MediaPipePoseEstimator {
  return new MediaPipePoseEstimator({ wasmBaseUrl: '/wasm' });
}

function delegatesTried(): string[] {
  return mediapipe.createFromOptions.mock.calls.map(([, options]) => options.baseOptions.delegate);
}

beforeEach(() => {
  mediapipe.forVisionTasks.mockReset().mockResolvedValue({});
  mediapipe.createFromOptions.mockReset();
});

describe('MediaPipePoseEstimator', () => {
  it('shares one model load between overlapping init calls', async () => {
    // A run cancelled while the model loads, then a new run, calls init() twice.
    mediapipe.createFromOptions.mockResolvedValue(fakeLandmarker());
    const estimator = newEstimator();
    await Promise.all([estimator.init(), estimator.init()]);
    expect(mediapipe.createFromOptions).toHaveBeenCalledTimes(1);
  });

  it('tries again on the next init after a failed load', async () => {
    mediapipe.forVisionTasks.mockRejectedValueOnce(new Error('offline'));
    mediapipe.createFromOptions.mockResolvedValue(fakeLandmarker());
    const estimator = newEstimator();
    await expect(estimator.init()).rejects.toThrow('offline');
    await estimator.init();
    expect(mediapipe.createFromOptions).toHaveBeenCalledTimes(1);
  });

  it('falls back to the CPU when the GPU model fails to start', async () => {
    mediapipe.createFromOptions
      .mockRejectedValueOnce(new Error('no WebGL'))
      .mockResolvedValue(fakeLandmarker());
    await newEstimator().init();
    expect(delegatesTried()).toEqual(['GPU', 'CPU']);
  });

  it('switches to the CPU when the GPU fails on the first frame', async () => {
    const gpu = fakeLandmarker();
    gpu.detectForVideo.mockImplementation(() => {
      throw new Error('GPU lost');
    });
    const cpu = fakeLandmarker();
    mediapipe.createFromOptions.mockResolvedValueOnce(gpu).mockResolvedValueOnce(cpu);
    const estimator = newEstimator();
    await estimator.init();

    const pose = await estimator.estimate({ timeMs: 0, image: IMAGE }, 1);
    expect(pose.landmarks).toBeNull();
    expect(gpu.close).toHaveBeenCalled();
    expect(cpu.detectForVideo).toHaveBeenCalledTimes(1);
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
    expect(mediapipe.createFromOptions).toHaveBeenCalledTimes(2);
  });

  it('keeps timestamps increasing when the next clip starts again at 0', async () => {
    const landmarker = fakeLandmarker();
    mediapipe.createFromOptions.mockResolvedValue(landmarker);
    const estimator = newEstimator();
    await estimator.init();

    for (const timeMs of [0, 33, 0, 33]) await estimator.estimate({ timeMs, image: IMAGE }, 1);
    const timestamps = landmarker.detectForVideo.mock.calls.map(([, timestampMs]) => timestampMs);
    expect(timestamps).toEqual([0, 33, 34, 67]);
  });
});
