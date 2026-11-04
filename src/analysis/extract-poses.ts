import type { FrameSource, PoseEstimator, PoseFrame, PoseSequence } from '../core';

export interface ExtractPosesOptions {
  /** How many frames per second to analyse. 30 is enough to see every phase of a rep. */
  readonly sampleFps: number;
  /** Called after each frame with progress from 0 to 1. */
  readonly onProgress?: (fraction: number) => void;
  /** Called with each frame's pose as soon as it's found, e.g. to show tracking live. */
  readonly onFrame?: (pose: PoseFrame, aspectRatio: number) => void;
  /** Checked before each frame; return true to stop early. */
  readonly isCancelled?: () => boolean;
}

export class ExtractionCancelledError extends Error {
  constructor() {
    super('Pose extraction was cancelled.');
    this.name = 'ExtractionCancelledError';
  }
}

/**
 * Step 1 of the pipeline: runs the pose model on every sampled frame of the video. This is the
 * slow step, so it reports progress and can be cancelled. The estimator must already be
 * initialised.
 */
export async function extractPoses<TImage>(
  source: FrameSource<TImage>,
  estimator: PoseEstimator<TImage>,
  options: ExtractPosesOptions,
): Promise<PoseSequence> {
  const frames: PoseFrame[] = [];

  for await (const frame of source.frames(options.sampleFps)) {
    if (options.isCancelled?.()) throw new ExtractionCancelledError();
    const pose = await estimator.estimate(frame, source.aspectRatio);
    frames.push(pose);
    options.onFrame?.(pose, source.aspectRatio);
    if (source.durationMs > 0) {
      options.onProgress?.(Math.min(1, frame.timeMs / source.durationMs));
    }
  }

  options.onProgress?.(1);
  return { sampleFps: options.sampleFps, aspectRatio: source.aspectRatio, frames };
}
