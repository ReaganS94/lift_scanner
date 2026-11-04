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

type Delegate = 'GPU' | 'CPU';
type Fileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

/** Finds poses with MediaPipe Pose Landmarker, running on the device. */
export class MediaPipePoseEstimator implements PoseEstimator<TexImageSource> {
  private readonly options: MediaPipePoseEstimatorOptions;
  private fileset: Fileset | null = null;
  private landmarker: PoseLandmarker | null = null;
  private delegate: Delegate = 'GPU';
  /** Whether the GPU has produced a result yet; until then a failure falls back to the CPU. */
  private gpuProven = false;
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
    this.fileset ??= await FilesetResolver.forVisionTasks(this.options.wasmBaseUrl);
    try {
      this.landmarker = await this.create('GPU');
    } catch {
      // Some phones and browsers can't run the model on the GPU. The CPU is slower but works.
      this.landmarker = await this.create('CPU');
    }
  }

  async estimate(frame: SampledFrame<TexImageSource>, aspectRatio: number): Promise<PoseFrame> {
    if (frame.timeMs + this.timestampOffsetMs <= this.lastTimestampMs) {
      this.timestampOffsetMs = this.lastTimestampMs + 1 - frame.timeMs;
    }
    this.lastTimestampMs = frame.timeMs + this.timestampOffsetMs;

    let result;
    try {
      result = this.requireLandmarker().detectForVideo(frame.image, this.lastTimestampMs);
    } catch (error) {
      // Some GPU problems only show up on the first frame rather than at start-up.
      if (this.delegate !== 'GPU' || this.gpuProven) throw error;
      this.landmarker?.close();
      this.landmarker = await this.create('CPU');
      result = this.landmarker.detectForVideo(frame.image, this.lastTimestampMs);
    }
    if (this.delegate === 'GPU') this.gpuProven = true;

    const pose = result.landmarks[0];
    return { timeMs: frame.timeMs, landmarks: pose ? toSharedUnits(pose, aspectRatio) : null };
  }

  dispose(): void {
    this.landmarker?.close();
    this.landmarker = null;
  }

  private async create(delegate: Delegate): Promise<PoseLandmarker> {
    if (!this.fileset) throw new Error('Call init() before estimate().');
    const landmarker = await PoseLandmarker.createFromOptions(this.fileset, {
      baseOptions: { modelAssetPath: this.options.modelUrl ?? DEFAULT_POSE_MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
    this.delegate = delegate;
    return landmarker;
  }

  private requireLandmarker(): PoseLandmarker {
    if (!this.landmarker) throw new Error('Call init() before estimate().');
    return this.landmarker;
  }
}
