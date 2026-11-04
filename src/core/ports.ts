import type { PoseFrame } from './pose';

/**
 * A decoded video frame ready for the pose model. Core only passes it along and never reads
 * it, so the browser type is referenced here but no browser API is used.
 */
export type FrameImage = TexImageSource;

export interface SampledFrame {
  readonly timeMs: number;
  readonly image: FrameImage;
}

/** Turns a video into frames at a fixed rate. Implemented in src/adapters/video/. */
export interface FrameSource {
  /** Total length of the clip, in milliseconds. */
  readonly durationMs: number;
  frames(sampleFps: number): AsyncIterable<SampledFrame>;
}

/** Finds the body pose in a frame. Implemented in src/adapters/pose/. */
export interface PoseEstimator {
  init(): Promise<void>;
  estimate(frame: SampledFrame): Promise<PoseFrame>;
  dispose(): void;
}
