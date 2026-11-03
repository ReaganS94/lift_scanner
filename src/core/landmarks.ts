/** One body point from the pose model. */
export interface Landmark {
  /** Horizontal position, 0 (left edge) to 1 (right edge) of the frame. */
  readonly x: number;
  /** Vertical position, 0 (top edge) to 1 (bottom edge) of the frame. Grows downwards. */
  readonly y: number;
  /** The model's depth estimate. Rough: use it as a hint only. */
  readonly z: number;
  /** How confident the model is that this point is visible, 0 to 1. */
  readonly visibility: number;
}

/**
 * Index of each point in the 33-point BlazePose skeleton, the layout MediaPipe uses.
 * This is the app's canonical skeleton: an adapter for any other model must map into it.
 */
export const LANDMARK = {
  nose: 0,
  leftEyeInner: 1,
  leftEye: 2,
  leftEyeOuter: 3,
  rightEyeInner: 4,
  rightEye: 5,
  rightEyeOuter: 6,
  leftEar: 7,
  rightEar: 8,
  mouthLeft: 9,
  mouthRight: 10,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftPinky: 17,
  rightPinky: 18,
  leftIndex: 19,
  rightIndex: 20,
  leftThumb: 21,
  rightThumb: 22,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

export type LandmarkName = keyof typeof LANDMARK;

export const LANDMARK_COUNT = 33;
