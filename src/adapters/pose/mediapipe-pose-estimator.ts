import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { PoseEstimator, PoseFrame, SampledFrame } from '../../core';
import { toSharedUnits } from './to-shared-units';

/**
 * The "full" pose model: the middle of MediaPipe's lite, full and heavy options, a good
 * balance of accuracy and speed on a phone. Pinned to a version so results don't change
 * underneath us. Downloaded once (about 9 MB), then cached by the browser.
 */
export const DEFAULT_POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

export interface MediaPipePoseEstimatorOptions {
  /** Where MediaPipe's wasm files are served. scripts/copy-mediapipe-wasm.mjs puts them here. */
  readonly wasmBaseUrl: string;
  readonly modelUrl?: string;
}

/** Finds poses with MediaPipe Pose Landmarker, running on the device. */
export class MediaPipePoseEstimator implements PoseEstimator<TexImageSource> {
  private readonly options: MediaPipePoseEstimatorOptions;
  private landmarker: PoseLandmarker | null = null;
  /**
   * MediaPipe's video mode needs timestamps that only ever increase. Each new clip starts again
   * at 0, so later clips are shifted to start after the last timestamp used.
   */
  private timestampOffsetMs = 0;
  private lastTimestampMs = -1;

  constructor(options: MediaPipePoseEstimatorOptions) {
    this.options = options;
  }

  async init(): Promise<void> {
    if (this.landmarker) return;
    const fileset = await FilesetResolver.forVisionTasks(this.options.wasmBaseUrl);
    const modelAssetPath = this.options.modelUrl ?? DEFAULT_POSE_MODEL_URL;
    const create = (delegate: 'GPU' | 'CPU') =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath, delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
      });

    try {
      this.landmarker = await create('GPU');
    } catch {
      // Some phones and browsers can't run the model on the GPU. The CPU is slower but works.
      this.landmarker = await create('CPU');
    }
  }

  estimate(frame: SampledFrame<TexImageSource>, aspectRatio: number): Promise<PoseFrame> {
    if (!this.landmarker) throw new Error('Call init() before estimate().');
    if (frame.timeMs + this.timestampOffsetMs <= this.lastTimestampMs) {
      this.timestampOffsetMs = this.lastTimestampMs + 1 - frame.timeMs;
    }
    this.lastTimestampMs = frame.timeMs + this.timestampOffsetMs;

    const result = this.landmarker.detectForVideo(frame.image, this.lastTimestampMs);
    const pose = result.landmarks[0];
    return Promise.resolve({
      timeMs: frame.timeMs,
      landmarks: pose ? toSharedUnits(pose, aspectRatio) : null,
    });
  }

  dispose(): void {
    this.landmarker?.close();
    this.landmarker = null;
  }
}
