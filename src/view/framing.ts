import type { LandmarkName, PoseFrame, PoseSequence, View } from '../core';
import { pointAt } from '../geometry';
import { median } from '../signal';
import { detectView } from './detect-view';

/** What the framing check tells the lifter, from the last moment or so of a live preview. */
export interface FramingAdvice {
  /** 'good' when nothing needs changing; 'adjust' when `tips` says what to change. */
  readonly status: 'no-one' | 'adjust' | 'good';
  /** Plain-language changes to make, most important first. Empty when status is 'good'. */
  readonly tips: readonly string[];
  /** Roughly how far the camera is from the wanted view, in degrees, when it could be told. */
  readonly degreesOff: number | null;
}

/**
 * Within this many degrees of the wanted view, the camera is good enough. Straight side-on
 * clips read about 10° from body proportions alone, so tighter would never pass.
 */
const GOOD_UP_TO_DEGREES = 20;
/**
 * Side views are corrected for the camera angle up to 45° (analysis/correct-for-camera-angle),
 * so up to there the tip is a suggestion; past it, checks can't be trusted.
 */
const CORRECTED_UP_TO_DEGREES = 45;
/**
 * The lifter should fill at least this much of the frame's longer body direction: height when
 * standing, width when lying on a bench. Smaller and joints are only a few pixels apart. Reagan's
 * side-on deadlift clip, which tracks well, spans about 0.35 from nose to ankle.
 */
const MIN_BODY_SPAN = 0.3;
/** Points closer than this to an edge, in frame heights, are as good as cut off. */
const EDGE_MARGIN = 0.02;
/** A body point the model is less sure of than this counts as not in the picture. */
const MIN_VISIBILITY = 0.5;
/** The lifter must be found in at least this share of the frames looked at. */
const MIN_FOUND_SHARE = 0.5;

const HEAD: readonly LandmarkName[] = ['nose'];
const FEET: readonly LandmarkName[] = ['leftAnkle', 'rightAnkle', 'leftHeel', 'rightHeel'];
const BODY: readonly LandmarkName[] = [
  'nose',
  'leftShoulder',
  'rightShoulder',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle',
];

/**
 * Checks a short stretch of live preview poses against what the lift needs: the wanted view,
 * the whole body in the picture, and big enough to measure. Pass the last second or so of
 * frames, so one bad frame doesn't flip the advice.
 *
 * It can tell how far the camera is turned, but not which way, so the tips say how far and
 * leave the direction to the lifter, who can see the picture.
 */
export function checkFraming(recent: PoseSequence, wanted: View): FramingAdvice {
  const found = recent.frames.filter((frame) => frame.landmarks !== null);
  if (found.length === 0 || found.length < MIN_FOUND_SHARE * recent.frames.length) {
    return {
      status: 'no-one',
      tips: ['Step into the picture so your whole body is in view.'],
      degreesOff: null,
    };
  }

  const tips: string[] = [];
  const width = recent.aspectRatio;
  const inPicture = (names: readonly LandmarkName[]) =>
    mostly(found, (frame) => names.some((name) => isInside(frame, name, width)));
  if (!inPicture(HEAD)) tips.push('Your head is out of the picture. Step back or tilt the phone.');
  if (!inPicture(FEET)) tips.push('Your feet are out of the picture. Step back or tilt the phone.');

  const span = median(found.map((frame) => bodySpan(frame)));
  if (span !== null && span < MIN_BODY_SPAN) {
    tips.push('You look small in the picture. Move the phone closer.');
  }

  const degreesOff = degreesFromWanted(found, recent, wanted);
  const angleTip = degreesOff === null ? null : turnTip(degreesOff, wanted);
  // A wrong angle spoils every check, so it goes first.
  if (angleTip) tips.unshift(angleTip);

  return { status: tips.length === 0 ? 'good' : 'adjust', tips, degreesOff };
}

function degreesFromWanted(
  found: readonly PoseFrame[],
  recent: PoseSequence,
  wanted: View,
): number | null {
  const { angleFromSide } = detectView({ ...recent, frames: found });
  if (angleFromSide === null) return null;
  return wanted === 'side' ? angleFromSide : 90 - angleFromSide;
}

function turnTip(degreesOff: number, wanted: View): string | null {
  if (degreesOff <= GOOD_UP_TO_DEGREES) return null;
  const degrees = String(Math.round(degreesOff));
  const target = wanted === 'side' ? 'side-on' : `${wanted}-on`;
  if (wanted === 'side' && degreesOff <= CORRECTED_UP_TO_DEGREES) {
    return `The camera is about ${degrees}° off ${target}. That's corrected for, but turning it to face your side gives better results.`;
  }
  const facing = { side: 'your side', front: 'you', back: 'your back' }[wanted];
  return `The camera is about ${degrees}° off ${target}. Turn it until it faces ${facing} square-on.`;
}

/** Whether the point is seen and clear of the frame's edges. */
function isInside(frame: PoseFrame, name: LandmarkName, width: number): boolean {
  const point = pointAt(frame, name, MIN_VISIBILITY);
  if (!point) return false;
  return (
    point.x >= EDGE_MARGIN &&
    point.x <= width - EDGE_MARGIN &&
    point.y >= EDGE_MARGIN &&
    point.y <= 1 - EDGE_MARGIN
  );
}

/** How far the body stretches along its longer direction, in frame heights. */
function bodySpan(frame: PoseFrame): number | null {
  const points = BODY.map((name) => pointAt(frame, name, MIN_VISIBILITY)).filter(
    (point) => point !== null,
  );
  if (points.length < 2) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

/** True when the test holds for over half the frames. */
function mostly(frames: readonly PoseFrame[], test: (frame: PoseFrame) => boolean): boolean {
  return frames.filter(test).length * 2 > frames.length;
}
