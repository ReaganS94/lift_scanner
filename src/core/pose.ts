import type { BarPoint } from './bar';
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
  /** The video's width divided by its height, e.g. 0.5625 for a portrait 9:16 clip. */
  readonly aspectRatio: number;
  readonly frames: readonly PoseFrame[];
  /**
   * The bar's end in each frame, one entry per frame (null where it wasn't found). Absent when
   * the bar wasn't followed, which is the case for lifts that don't ask for it.
   */
  readonly barTrack?: readonly (BarPoint | null)[];
}
