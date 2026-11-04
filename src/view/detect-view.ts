import type { PoseSequence, View } from '../core';
import { averagePoint, HIPS, length, pointAt, SHOULDERS, subtract } from '../geometry';
import { median } from '../signal';

/** The app's guess at the camera view, for the user to confirm or correct. */
export interface ViewGuess {
  /** Null when the clip doesn't clearly match any supported view. */
  readonly view: View | null;
  /** 'low' means the user should look twice before confirming. */
  readonly confidence: 'high' | 'low';
  /** A plain-language reason, shown next to the guess. */
  readonly reason: string;
}

/**
 * From the side the shoulders overlap, so they look narrow next to the torso. From the front or
 * back they look roughly as wide as the torso is long. These are the ratio cut-offs between them.
 */
const SIDE_MAX_RATIO = 0.35;
const FRONT_MIN_RATIO = 0.55;
/** Below this ratio a side view is clear-cut. */
const CLEAR_SIDE_RATIO = 0.25;

/**
 * Hidden points still get an estimated position from the model, which is enough to measure
 * shoulder width, so a low bar is used here rather than the usual visibility threshold.
 */
const POSITION_MIN_VISIBILITY = 0.1;
/** Above this, the face is treated as visible to the camera. */
const FACE_VISIBLE = 0.5;

/** Guesses the camera view from body proportions across the whole clip. */
export function detectView(sequence: PoseSequence): ViewGuess {
  const ratios: (number | null)[] = [];
  const faceVisibility: (number | null)[] = [];
  const leftOnImageRight: (number | null)[] = [];

  for (const frame of sequence.frames) {
    const left = pointAt(frame, 'leftShoulder', POSITION_MIN_VISIBILITY);
    const right = pointAt(frame, 'rightShoulder', POSITION_MIN_VISIBILITY);
    const shoulders = averagePoint(frame, SHOULDERS, POSITION_MIN_VISIBILITY);
    const hips = averagePoint(frame, HIPS, POSITION_MIN_VISIBILITY);
    if (!left || !right || !shoulders || !hips) continue;

    const torso = length(subtract(shoulders, hips));
    if (torso === 0) continue;

    ratios.push(length(subtract(left, right)) / torso);
    faceVisibility.push(frame.landmarks?.[0]?.visibility ?? null);
    leftOnImageRight.push(left.x > right.x ? 1 : 0);
  }

  const ratio = median(ratios);
  if (ratio === null) {
    return {
      view: null,
      confidence: 'low',
      reason: "Couldn't see your shoulders and hips clearly enough to tell the camera angle.",
    };
  }

  if (ratio <= SIDE_MAX_RATIO) {
    return {
      view: 'side',
      confidence: ratio <= CLEAR_SIDE_RATIO ? 'high' : 'low',
      reason: 'Your shoulders overlap in the frame, which happens when filming from the side.',
    };
  }

  if (ratio < FRONT_MIN_RATIO) {
    return {
      view: null,
      confidence: 'low',
      reason:
        'The camera looks to be at an angle between side and front. Pick the closer view, or ' +
        're-film square-on for more reliable checks.',
    };
  }

  const faceSeen = (median(faceVisibility) ?? 0) >= FACE_VISIBLE;
  const mirroredLikeFront = (median(leftOnImageRight) ?? 0) >= 0.5;
  const view: View = faceSeen ? 'front' : 'back';
  return {
    view,
    confidence: faceSeen === mirroredLikeFront ? 'high' : 'low',
    reason: faceSeen
      ? 'Both shoulders are in view and your face is visible, so this looks like a front view.'
      : 'Both shoulders are in view but your face is hidden, so this looks like a back view.',
  };
}
