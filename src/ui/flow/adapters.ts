import type { FrameSource, PoseEstimator, RegionReader, StillPoseEstimator } from '../../core';

/** A frame source the screens can release when a clip is finished with. */
export interface DisposableFrameSource<TImage> extends FrameSource<TImage> {
  dispose(): void;
}

/** A photo the screens can show and release when finished with. */
export interface OpenedPhoto<TImage> {
  /** The photo as the pose model reads it. */
  readonly image: TImage;
  /** Width divided by height. */
  readonly aspectRatio: number;
  /** A URL for showing the same picture the pose was found in. Valid until dispose(). */
  readonly url: string;
  dispose(): void;
}

/**
 * The browser adapters the screens need. Built in main.tsx and passed in, so the screens can
 * be run with fakes and the adapters can be swapped without touching the UI.
 */
export interface AnalysisAdapters<TImage> {
  openVideo(url: string): Promise<DisposableFrameSource<TImage>>;
  /** Reads a photo file, upright. */
  openPhoto(file: Blob): Promise<OpenedPhoto<TImage>>;
  /**
   * The pose estimator, for videos and photos alike. Called once by each screen flow that needs
   * it, so it should hand back the same estimator each time: the model then loads only once.
   */
  createPoseEstimator(): PoseEstimator<TImage> & StillPoseEstimator<TImage>;
  /** For following the bar in lifts that ask for it. */
  createRegionReader(): RegionReader<TImage>;
}
