/**
 * Builders for made-up but plausible pose data, for tests only. App code must not import this
 * folder (enforced by dependency-cruiser).
 */
import {
  LANDMARK,
  LANDMARK_COUNT,
  type Landmark,
  type LandmarkName,
  type PoseFrame,
  type PoseSequence,
  type View,
} from '../core';

/** A portrait 9:16 phone clip. */
export const PORTRAIT_ASPECT = 9 / 16;
const CENTRE_X = PORTRAIT_ASPECT / 2;

type Offsets = Partial<Record<LandmarkName, { x: number; y: number }>>;

/** A standing lifter seen from the front. The lifter's left side appears on the image's right. */
const FRONT: Offsets = {
  nose: { x: 0, y: 0.15 },
  leftEye: { x: 0.02, y: 0.14 },
  rightEye: { x: -0.02, y: 0.14 },
  leftShoulder: { x: 0.1, y: 0.25 },
  rightShoulder: { x: -0.1, y: 0.25 },
  leftElbow: { x: 0.13, y: 0.37 },
  rightElbow: { x: -0.13, y: 0.37 },
  leftWrist: { x: 0.14, y: 0.48 },
  rightWrist: { x: -0.14, y: 0.48 },
  leftHip: { x: 0.06, y: 0.5 },
  rightHip: { x: -0.06, y: 0.5 },
  leftKnee: { x: 0.07, y: 0.68 },
  rightKnee: { x: -0.07, y: 0.68 },
  leftAnkle: { x: 0.07, y: 0.88 },
  rightAnkle: { x: -0.07, y: 0.88 },
};

/** A standing lifter seen from their left side, facing the image's right. */
const SIDE: Offsets = {
  nose: { x: 0.04, y: 0.15 },
  leftEye: { x: 0.035, y: 0.14 },
  rightEye: { x: 0.03, y: 0.14 },
  leftShoulder: { x: 0.01, y: 0.25 },
  rightShoulder: { x: -0.01, y: 0.25 },
  leftElbow: { x: 0.01, y: 0.37 },
  rightElbow: { x: -0.01, y: 0.37 },
  leftWrist: { x: 0.01, y: 0.48 },
  rightWrist: { x: -0.01, y: 0.48 },
  leftHip: { x: 0.005, y: 0.5 },
  rightHip: { x: -0.005, y: 0.5 },
  leftKnee: { x: 0.03, y: 0.68 },
  rightKnee: { x: 0.025, y: 0.68 },
  leftAnkle: { x: 0, y: 0.88 },
  rightAnkle: { x: -0.005, y: 0.88 },
};

const FACE: readonly LandmarkName[] = [
  'nose',
  'leftEyeInner',
  'leftEye',
  'leftEyeOuter',
  'rightEyeInner',
  'rightEye',
  'rightEyeOuter',
  'leftEar',
  'rightEar',
  'mouthLeft',
  'mouthRight',
];

/** All 33 landmarks of a standing lifter, seen from the given view. */
export function standingFigure(view: View): Landmark[] {
  const offsets = view === 'side' ? SIDE : FRONT;
  // From behind, the lifter's left side appears on the image's left.
  const mirror = view === 'back' ? -1 : 1;

  const landmarks: Landmark[] = Array.from({ length: LANDMARK_COUNT }, () => ({
    x: CENTRE_X,
    y: 0.15,
    z: 0,
    visibility: 0.9,
  }));

  for (const [name, offset] of Object.entries(offsets) as [
    LandmarkName,
    { x: number; y: number },
  ][]) {
    landmarks[LANDMARK[name]] = {
      x: CENTRE_X + offset.x * mirror,
      y: offset.y,
      z: 0,
      visibility: 0.95,
    };
  }

  if (view === 'back') {
    for (const name of FACE) setVisibility(landmarks, name, 0.15);
  }
  return landmarks;
}

/** A copy of the landmarks with the named points moved by (dx, dy). */
export function moved(
  landmarks: readonly Landmark[],
  names: readonly LandmarkName[],
  dx: number,
  dy: number,
): Landmark[] {
  const result = [...landmarks];
  for (const name of names) {
    const point = result[LANDMARK[name]];
    if (point) result[LANDMARK[name]] = { ...point, x: point.x + dx, y: point.y + dy };
  }
  return result;
}

/** A copy of the landmarks flipped left to right, as if filmed from the opposite side. */
export function mirrored(
  landmarks: readonly Landmark[],
  aspectRatio = PORTRAIT_ASPECT,
): Landmark[] {
  return landmarks.map((point) => ({ ...point, x: aspectRatio - point.x }));
}

export function setVisibility(landmarks: Landmark[], name: LandmarkName, visibility: number): void {
  const point = landmarks[LANDMARK[name]];
  if (point) landmarks[LANDMARK[name]] = { ...point, visibility };
}

/** Wraps per-frame landmarks into a sequence sampled at `sampleFps`. */
export function sequenceOf(
  frames: readonly (readonly Landmark[] | null)[],
  sampleFps = 30,
  aspectRatio = PORTRAIT_ASPECT,
): PoseSequence {
  return {
    sampleFps,
    aspectRatio,
    frames: frames.map((landmarks, index): PoseFrame => ({
      timeMs: (index * 1000) / sampleFps,
      landmarks,
    })),
  };
}

/**
 * Per-frame amounts that sit at 0 for `restFrames`, rise smoothly to `amplitude` and fall back
 * over `repFrames`, `reps` times, then rest again. Handy for driving a fake set of reps.
 */
export function repWave(options: {
  reps: number;
  repFrames: number;
  restFrames: number;
  amplitude: number;
}): number[] {
  const { reps, repFrames, restFrames, amplitude } = options;
  const values: number[] = [];
  const rest = () => {
    for (let i = 0; i < restFrames; i++) values.push(0);
  };

  rest();
  for (let rep = 0; rep < reps; rep++) {
    for (let i = 0; i < repFrames; i++) {
      values.push((amplitude * (1 - Math.cos((2 * Math.PI * i) / repFrames))) / 2);
    }
    rest();
  }
  return values;
}

export const UPPER_BODY: readonly LandmarkName[] = [
  ...FACE,
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftPinky',
  'rightPinky',
  'leftIndex',
  'rightIndex',
  'leftThumb',
  'rightThumb',
  'leftHip',
  'rightHip',
];
