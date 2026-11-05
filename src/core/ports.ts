import type { FrameRegion, GrayImage } from './image';
import type { PoseFrame } from './pose';

/**
 * Interfaces for the code that talks to the outside world. The pure modules only pass frames
 * from a FrameSource to a PoseEstimator and never look inside them, so the image type is a
 * type parameter: adapters agree on it (for example an HTMLVideoElement) and core stays free of
 * browser types.
 */

export interface SampledFrame<TImage> {
  readonly timeMs: number;
  readonly image: TImage;
}

/** Turns a video into frames at a fixed rate. Implemented in src/adapters/video/. */
export interface FrameSource<TImage> {
  /** Total length of the clip, in milliseconds. */
  readonly durationMs: number;
  /** The video's width divided by its height. */
  readonly aspectRatio: number;
  frames(sampleFps: number): AsyncIterable<SampledFrame<TImage>>;
}

/** Finds the body pose in a frame. Implemented in src/adapters/pose/. */
export interface PoseEstimator<TImage> {
  init(): Promise<void>;
  /** Landmarks must be returned in the shared unit described on Landmark. */
  estimate(frame: SampledFrame<TImage>, aspectRatio: number): Promise<PoseFrame>;
  dispose(): void;
}

/**
 * Reads part of a frame as a small greyscale picture, for following things the pose model
 * doesn't see, such as the bar. Implemented in src/adapters/video/.
 */
export interface RegionReader<TImage> {
  /**
   * The part of `image` inside `region`, scaled to `pixelsPerUnit` pixels per frame height.
   * Parts of the region outside the frame come back black.
   */
  read(image: TImage, region: FrameRegion, pixelsPerUnit: number): GrayImage;
}
