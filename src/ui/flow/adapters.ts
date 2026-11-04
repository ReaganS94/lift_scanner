import type { FrameSource, PoseEstimator } from '../../core';

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
}
