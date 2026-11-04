import type { PoseFrame } from '../../core';

/** The latest pose found while a clip is being tracked, for showing tracking live. */
export interface LivePose {
  readonly pose: PoseFrame;
  /** The video's width divided by its height. */
  readonly aspectRatio: number;
}

/**
 * Where the flow leaves the latest pose. A plain mutable box rather than React state: poses
 * arrive many times a second, and only a canvas that redraws on its own reads them.
 */
export interface LivePoseBox {
  current: LivePose | null;
}
