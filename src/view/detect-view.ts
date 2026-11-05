import type { PoseFrame, PoseSequence, View } from '../core';
import { averagePoint, HIPS, length, pointAt, SHOULDERS, subtract, type Vec2 } from '../geometry';
import { median, percentile } from '../signal';

/** The app's guess at the camera view, for the user to confirm or correct. */
export interface ViewGuess {
  /** Null when the clip doesn't clearly match any supported view. */
  readonly view: View | null;
  /** 'low' means the user should look twice before confirming. */
  readonly confidence: 'high' | 'low';
  /** A plain-language reason, shown next to the guess. */
  readonly reason: string;
  /**
   * Roughly how far the camera is turned away from side-on, in degrees: 0 is straight side-on,
   * 90 is straight front-on or back-on. Null when the shoulders and hips weren't seen. Rough,
   * since shoulder width varies from person to person: side-on clips read about 10°.
   */
  readonly angleFromSide: number | null;
}

/*
 * How the angle is estimated: the apparent shoulder width shrinks with the cosine of the
 * camera's angle away from square-on, while the torso length (shoulders to hips) stays the
 * same. Square-on, shoulder width is about 0.8 of torso length for a typical adult, so:
 *
 *   ratio ≈ 0.8 × cos(angle from front)
 *
 * A side view is accepted up to 45° off side-on, since the side checks correct their angles for
 * how far the camera is turned (see analysis/correct-for-camera-angle). A front or back view
 * must be within 30° of square-on. Proportions vary from person to person, which is one reason
 * the user confirms the guess.
 */
const FRONT_RATIO = 0.8;
const degrees = (value: number) => (value * Math.PI) / 180;
/** Within 45° of side-on. */
const SIDE_MAX_RATIO = FRONT_RATIO * Math.sin(degrees(45)); // ≈ 0.57
/** Within 30° of side-on: no need to say the camera is at an angle. */
const SURE_SIDE_RATIO = FRONT_RATIO * Math.sin(degrees(30)); // ≈ 0.40
/** Within 30° of front-on. */
const FRONT_MIN_RATIO = FRONT_RATIO * Math.cos(degrees(30)); // ≈ 0.69
/** Within 15° of side-on: clear-cut. */
const CLEAR_SIDE_RATIO = FRONT_RATIO * Math.sin(degrees(15)); // ≈ 0.21
/** Within 15° of front-on: clear-cut. */
const CLEAR_FRONT_RATIO = FRONT_RATIO * Math.cos(degrees(15)); // ≈ 0.77

/**
 * Leaning towards or away from the camera shortens the torso in the image, which inflates the
 * ratio. Only frames where the torso looks close to its full length are used: for a squat or
 * deadlift that's the standing frames; for a bench press, where the torso doesn't tilt, it's
 * all of them.
 */
const FULL_TORSO_FRACTION = 0.9;

/**
 * Hidden points still get an estimated position from the model, which is enough to measure
 * shoulder width, so a low bar is used here rather than the usual visibility threshold. This is
 * also why the view must be guessed from the raw poses, before cleanup drops hidden points.
 */
const POSITION_MIN_VISIBILITY = 0.1;
/** Face visibility outside this band is a clear sign of facing towards or away. */
const FACE_HIDDEN_BELOW = 0.2;
const FACE_SEEN_ABOVE = 0.8;

interface FrameMeasure {
  readonly frame: PoseFrame;
  readonly left: Vec2;
  readonly right: Vec2;
  readonly torso: number;
}

/** Guesses the camera view from body proportions. Pass the raw, uncleaned poses. */
export function detectView(rawSequence: PoseSequence): ViewGuess {
  const measures = rawSequence.frames.flatMap((frame) => {
    const measure = measureFrame(frame);
    return measure ? [measure] : [];
  });

  const fullTorso = percentile(
    measures.map((m) => m.torso),
    0.9,
  );
  const upright = measures.filter(
    (m) => fullTorso !== null && m.torso >= fullTorso * FULL_TORSO_FRACTION,
  );
  const ratio = median(upright.map((m) => length(subtract(m.left, m.right)) / m.torso));

  if (ratio === null) {
    return {
      view: null,
      confidence: 'low',
      reason: "Couldn't see your shoulders and hips clearly enough to tell the camera angle.",
      angleFromSide: null,
    };
  }
  const angleFromSide = angleFromRatio(ratio);

  if (ratio <= SIDE_MAX_RATIO) {
    return {
      view: 'side',
      confidence: ratio <= CLEAR_SIDE_RATIO ? 'high' : 'low',
      reason:
        ratio <= SURE_SIDE_RATIO
          ? 'Your shoulders overlap in the frame, which happens when filming from the side.'
          : `The camera looks about ${String(Math.round(angleFromSide))}° off side-on. ` +
            'Angles are corrected for that, but side-on is more reliable.',
      angleFromSide,
    };
  }

  if (ratio < FRONT_MIN_RATIO) {
    return {
      view: null,
      confidence: 'low',
      reason:
        `The camera looks about ${String(Math.round(angleFromSide))}° off side-on, between ` +
        'side and front. Pick the closer view, or re-film closer to side-on or front-on.',
      angleFromSide,
    };
  }

  return { ...guessFrontOrBack(upright, ratio >= CLEAR_FRONT_RATIO), angleFromSide };
}

/** Degrees off side-on for a shoulder-width ratio: the ratio is FRONT_RATIO × sin(angle). */
function angleFromRatio(ratio: number): number {
  return (Math.asin(Math.min(1, ratio / FRONT_RATIO)) * 180) / Math.PI;
}

function measureFrame(frame: PoseFrame): FrameMeasure | null {
  const left = pointAt(frame, 'leftShoulder', POSITION_MIN_VISIBILITY);
  const right = pointAt(frame, 'rightShoulder', POSITION_MIN_VISIBILITY);
  const shoulders = averagePoint(frame, SHOULDERS, POSITION_MIN_VISIBILITY);
  const hips = averagePoint(frame, HIPS, POSITION_MIN_VISIBILITY);
  if (!left || !right || !shoulders || !hips) return null;

  const torso = length(subtract(shoulders, hips));
  return torso > 0 ? { frame, left, right, torso } : null;
}

/**
 * Front and back look alike in proportions, so two weaker cues are combined: whether the face
 * is visible, and whether the lifter's left shoulder appears on the image's right (as it does
 * when facing the camera). Only a clear, agreeing answer gets high confidence: the model is
 * known to sometimes report a face from behind.
 */
function guessFrontOrBack(
  measures: readonly FrameMeasure[],
  clearAngle: boolean,
): Omit<ViewGuess, 'angleFromSide'> {
  const faceVisibility =
    median(measures.map((m) => m.frame.landmarks?.[0]?.visibility ?? null)) ?? 0;
  const mirroredLikeFront =
    (median(measures.map((m) => (m.left.x > m.right.x ? 1 : 0))) ?? 0) >= 0.5;

  const faceSeen = faceVisibility >= 0.5;
  const faceClear = faceVisibility >= FACE_SEEN_ABOVE || faceVisibility < FACE_HIDDEN_BELOW;
  const view: View = faceSeen ? 'front' : 'back';

  return {
    view,
    confidence: clearAngle && faceClear && faceSeen === mirroredLikeFront ? 'high' : 'low',
    reason: faceSeen
      ? 'Both shoulders are in view and your face seems visible, so this looks like a front view.'
      : 'Both shoulders are in view but your face seems hidden, so this looks like a back view.',
  };
}
