import { FilesetResolver } from '@mediapipe/tasks-vision';
import type { PoseEstimator, PoseFrame, SampledFrame, StillPoseEstimator } from '../../core';
import {
  createPoseModels,
  DEFAULT_POSE_MODEL_URL,
  type Delegate,
  type Fileset,
  type PoseModels,
} from './mediapipe-models';
import { toSharedUnits, type NormalizedLandmark } from './to-shared-units';

export interface MediaPipePoseEstimatorOptions {
  /** Where MediaPipe's wasm files are served. scripts/copy-mediapipe-wasm.mjs puts them here. */
  readonly wasmBaseUrl: string;
  readonly modelUrl?: string;
}

/**
 * The finder looks for everyone in one frame in this many. At 30 frames a second that is six
 * times a second, often enough that the signal step's gap filling bridges the frames between.
 */
const FIND_EVERY_FRAMES = 5;

/**
 * Finds poses with MediaPipe Pose Landmarker, running on the device.
 *
 * Every frame's pose comes from a tracker that follows one person smoothly; every few frames a
 * finder also looks for everyone (see PoseModels). All of them go in PoseFrame.people, and
 * people/pickLifter later works out which is the lifter.
 */
export class MediaPipePoseEstimator
  implements PoseEstimator<TexImageSource>, StillPoseEstimator<TexImageSource>
{
  private readonly options: MediaPipePoseEstimatorOptions;
  private fileset: Fileset | null = null;
  private models: PoseModels | null = null;
  /**
   * The load in progress or done. Shared so that a run cancelled while the model loads, followed
   * by a new run, waits for the same load instead of creating a second model.
   */
  private loading: Promise<void> | null = null;
  /** Bumped by dispose(), so a load that finishes afterwards knows it is no longer wanted. */
  private generation = 0;
  /** Whether the GPU has produced a result yet; until then a failure falls back to the CPU. */
  private gpuProven = false;
  /**
   * MediaPipe's video mode needs timestamps that only ever increase. Each new clip starts again
   * at 0, so later clips are shifted to start after the last timestamp used.
   */
  private timestampOffsetMs = 0;
  private lastTimestampMs = -1;
  /** Frames looked at in this clip, so the finder runs on its first frame and every few after. */
  private clipFrames = 0;

  constructor(options: MediaPipePoseEstimatorOptions) {
    this.options = options;
  }

  init(): Promise<void> {
    if (this.loading) return this.loading;
    const loading = this.load().catch((error: unknown) => {
      // Let the next run try again, unless dispose() has already let a newer load start.
      if (this.loading === loading) this.loading = null;
      throw error;
    });
    this.loading = loading;
    return loading;
  }

  async estimate(frame: SampledFrame<TexImageSource>, aspectRatio: number): Promise<PoseFrame> {
    if (frame.timeMs + this.timestampOffsetMs <= this.lastTimestampMs) {
      // Time went back, so this is a new clip.
      this.timestampOffsetMs = this.lastTimestampMs + 1 - frame.timeMs;
      this.clipFrames = 0;
    }
    this.lastTimestampMs = frame.timeMs + this.timestampOffsetMs;
    const find = this.clipFrames % FIND_EVERY_FRAMES === 0;
    this.clipFrames += 1;

    const people = await this.withCpuFallback(() => this.look(frame.image, find));
    const shared = people.map((pose) => toSharedUnits(pose, aspectRatio));
    return { timeMs: frame.timeMs, landmarks: shared[0] ?? null, people: shared };
  }

  /**
   * One photo: only the finder looks, since there's nothing to track from. It doesn't touch the
   * tracker's timestamps, so a video analysed afterwards is unaffected.
   */
  async estimateStill(image: TexImageSource, aspectRatio: number): Promise<PoseFrame> {
    const people = await this.withCpuFallback(
      () => this.requireModels().finder.detect(image).landmarks,
    );
    const shared = people.map((pose) => toSharedUnits(pose, aspectRatio));
    return { timeMs: 0, landmarks: shared[0] ?? null, people: shared };
  }

  dispose(): void {
    this.models?.close();
    this.models = null;
    this.loading = null;
    this.generation += 1;
  }

  /**
   * The tracked person first, then everyone the finder saw, if it looked. The finder sees the
   * tracked person too; people/linkPeople drops such repeats.
   */
  private look(image: TexImageSource, find: boolean): NormalizedLandmark[][] {
    const { tracker, finder } = this.requireModels();
    const tracked = tracker.detectForVideo(image, this.lastTimestampMs).landmarks;
    return find ? [...tracked, ...finder.detect(image).landmarks] : tracked;
  }

  /** Runs the models, moving to the CPU if the GPU fails before it has ever worked. */
  private async withCpuFallback<T>(run: () => T): Promise<T> {
    let result: T;
    try {
      result = run();
    } catch (error) {
      // Some GPU problems only show up on the first frame rather than at start-up.
      if (this.requireModels().delegate !== 'GPU' || this.gpuProven) throw error;
      this.models?.close();
      this.models = await this.create('CPU');
      result = run();
    }
    if (this.requireModels().delegate === 'GPU') this.gpuProven = true;
    return result;
  }

  private async load(): Promise<void> {
    const generation = this.generation;
    this.fileset ??= await FilesetResolver.forVisionTasks(this.options.wasmBaseUrl);
    let models: PoseModels;
    try {
      models = await this.create('GPU');
    } catch {
      // Some phones and browsers can't run the model on the GPU. The CPU is slower but works.
      models = await this.create('CPU');
    }
    if (generation !== this.generation) {
      models.close();
      throw new Error('The pose model was released while it was loading.');
    }
    this.models = models;
  }

  private create(delegate: Delegate): Promise<PoseModels> {
    if (!this.fileset) throw new Error('Call init() before estimate().');
    const modelUrl = this.options.modelUrl ?? DEFAULT_POSE_MODEL_URL;
    return createPoseModels(this.fileset, delegate, modelUrl);
  }

  private requireModels(): PoseModels {
    if (!this.models) throw new Error('Call init() before estimate().');
    return this.models;
  }
}
