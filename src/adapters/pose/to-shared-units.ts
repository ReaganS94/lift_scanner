import type { Landmark } from '../../core';

/** A landmark as MediaPipe returns it: x and y as fractions of the frame's width and height. */
export interface NormalizedLandmark {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly visibility?: number;
}

/**
 * Converts MediaPipe's landmarks into the app's shared unit (see Landmark): x and z are scaled
 * by the aspect ratio so that, like y, they are measured in frame heights. Without this a true
 * 45° lean on a portrait 9:16 clip would read about 61° from vertical.
 */
export function toSharedUnits(
  landmarks: readonly NormalizedLandmark[],
  aspectRatio: number,
): Landmark[] {
  return landmarks.map((landmark) => ({
    x: landmark.x * aspectRatio,
    y: landmark.y,
    // MediaPipe documents z as using roughly the same scale as x.
    z: landmark.z * aspectRatio,
    visibility: landmark.visibility ?? 0,
  }));
}
