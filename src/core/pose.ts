import type { Landmark } from './landmarks';

/** The pose found in one sampled video frame. */
export interface PoseFrame {
  /** Time of the frame from the start of the clip, in milliseconds. */
  readonly timeMs: number;
  /** All 33 landmarks, or null when no person was found in the frame. */
  readonly landmarks: readonly Landmark[] | null;
}

/** Every sampled frame of a clip, in time order. */
export interface PoseSequence {
  /** How many frames per second were sampled from the video. */
  readonly sampleFps: number;
  readonly frames: readonly PoseFrame[];
}
