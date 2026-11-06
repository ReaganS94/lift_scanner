import type { FrameSource, PoseEstimator, RegionReader } from '../../core';

/** A frame source the screens can release when a clip is finished with. */
export interface DisposableFrameSource<TImage> extends FrameSource<TImage> {
  dispose(): void;
}

/**
 * The browser adapters the screens need. Built in main.tsx and passed in, so the screens can
 * be run with fakes and the adapters can be swapped without touching the UI.
 */
export interface AnalysisAdapters<TImage> {
  openVideo(url: string): Promise<DisposableFrameSource<TImage>>;
  createPoseEstimator(): PoseEstimator<TImage>;
  /** For following the bar in lifts that ask for it. */
  createRegionReader(): RegionReader<TImage>;
  /** The phone's back camera, live, for the framing check. Rejects with a readable message. */
  openCamera(): Promise<LiveCamera<TImage>>;
}

/** A live camera picture: shown on screen, and handed to the pose estimator frame by frame. */
export interface LiveCamera<TImage> {
  /**
   * Shows the live picture as the first child of `container`, with the given class. Returns a
   * function that takes it out again.
   */
  show(container: HTMLElement, className: string): () => void;
  /** The current picture, for the pose estimator. */
  readonly image: TImage;
  /** Width divided by height of the picture. */
  readonly aspectRatio: number;
  /** Turns the camera off. */
  stop(): void;
}
