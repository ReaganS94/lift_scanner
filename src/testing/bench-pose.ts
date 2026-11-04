/**
 * Builders for synthetic bench presses, for tests only. Lengths are in frame heights: a torso
 * of 0.25 (shoulder to hip), and an upper arm and forearm of 0.15 each, so a straight arm
 * reaches 0.3.
 */
import { LANDMARK, type Landmark, type LandmarkName, type RepContext, type View } from '../core';
import { repWave, sequenceOf, standingFigure } from './synthetic-pose';

export const BENCH_TORSO = 0.25;
const UPPER_ARM = 0.15;
const FOREARM = 0.15;
/** Where the shoulders are in the frame. */
const SHOULDER_Y = 0.6;
const SHOULDER_X = 0.15;

/** Where the hands are, relative to the shoulder. */
export interface BenchHands {
  /** Along the body towards the hips, as a share of the torso: 0 over the shoulders, 1 at the hips. */
  readonly along: number;
  /** Height above the shoulders, in frame heights. 0.3 is a straight arm straight up. */
  readonly height: number;
}

export const BENCH_LOCKOUT: BenchHands = { along: 0, height: 0.3 };
/** The bar on the middle of the chest. */
export const BENCH_TOUCH: BenchHands = { along: 0.35, height: 0.06 };

/** The hands a fraction `t` of the way from `from` to `to`. */
export function betweenHands(from: BenchHands, to: BenchHands, t: number): BenchHands {
  return {
    along: from.along + (to.along - from.along) * t,
    height: from.height + (to.height - from.height) * t,
  };
}

/**
 * A lifter lying on a bench, seen from their left side: head towards the image's left, feet to
 * the right. The elbow bends towards the feet and down, as it does in a press.
 */
export function sideBenchFigure(hands: BenchHands): Landmark[] {
  const result = standingFigure('side');
  const shoulder = { x: SHOULDER_X, y: SHOULDER_Y };
  const hip = { x: SHOULDER_X + BENCH_TORSO, y: SHOULDER_Y };
  const wrist = { x: shoulder.x + hands.along * BENCH_TORSO, y: shoulder.y - hands.height };
  const elbow = elbowBetween(shoulder, wrist);
  const knee = { x: hip.x + 0.18, y: SHOULDER_Y };
  const ankle = { x: knee.x + 0.02, y: SHOULDER_Y + 0.2 };

  for (const [side, depth] of [
    ['left', 0],
    ['right', -0.005],
  ] as const) {
    const shift = (point: { x: number; y: number }) => ({ x: point.x, y: point.y + depth });
    place(result, `${side}Shoulder`, shift(shoulder));
    place(result, `${side}Elbow`, shift(elbow));
    place(result, `${side}Wrist`, shift(wrist));
    place(result, `${side}Hip`, shift(hip));
    place(result, `${side}Knee`, shift(knee));
    place(result, `${side}Ankle`, shift(ankle));
  }
  place(result, 'nose', { x: SHOULDER_X - 0.08, y: SHOULDER_Y - 0.05 });
  return result;
}

/**
 * A lifter lying on a bench, seen from their feet, with the hands `height` above the
 * shoulders. `rightLag` lowers the right hand by that much, as when one arm lags. The
 * shoulders are 0.2 apart and the lifter's left side is on the image's right.
 */
export function frontBenchFigure(height: number, rightLag = 0): Landmark[] {
  const result = standingFigure('front');
  const centre = 0.28;
  for (const [side, direction, lag] of [
    ['left', 1, 0],
    ['right', -1, rightLag],
  ] as const) {
    const x = centre + direction * 0.1;
    place(result, `${side}Shoulder`, { x, y: SHOULDER_Y });
    place(result, `${side}Elbow`, { x: x + direction * 0.04, y: SHOULDER_Y - height / 2 + lag });
    place(result, `${side}Wrist`, { x: x + direction * 0.02, y: SHOULDER_Y - height + lag });
    // The hips are further from the camera, so they look closer together.
    place(result, `${side}Hip`, { x: centre + direction * 0.05, y: SHOULDER_Y + 0.05 });
  }
  return result;
}

const REST_FRAMES = 10;
const REP_FRAMES = 60;

/**
 * One bench rep from lockout down to the chest and back, with rest at lockout either side.
 * `figureAt` gives the landmarks for each point of the rep, from 0 (lockout) to 1 (bar on the
 * chest); `rising` is true on the way back up. The bottom is at frame 40.
 */
export function benchRep(
  view: View,
  figureAt: (t: number, rising: boolean) => Landmark[],
): RepContext {
  const wave = repWave({ reps: 1, repFrames: REP_FRAMES, restFrames: REST_FRAMES, amplitude: 1 });
  const bottom = REST_FRAMES + REP_FRAMES / 2;
  const frames = wave.map((t, index) => figureAt(t, index > bottom));
  return {
    sequence: sequenceOf(frames),
    view,
    torsoLength: BENCH_TORSO,
    nearSide: 'left',
    rep: {
      index: 0,
      startFrame: REST_FRAMES - 1,
      turnFrame: bottom,
      endFrame: REST_FRAMES + REP_FRAMES,
    },
  };
}

/** A side-view rep with the hands moving straight between `top` and `touch`. */
export function sideBenchRep(
  touch: BenchHands = BENCH_TOUCH,
  top: BenchHands = BENCH_LOCKOUT,
): RepContext {
  return benchRep('side', (t) => sideBenchFigure(betweenHands(top, touch, t)));
}

/** Where the elbow sits for a hand at `wrist`, bending towards the feet and down. */
function elbowBetween(
  shoulder: { x: number; y: number },
  wrist: { x: number; y: number },
): { x: number; y: number } {
  const dx = wrist.x - shoulder.x;
  const dy = wrist.y - shoulder.y;
  const reach = Math.min(Math.hypot(dx, dy), UPPER_ARM + FOREARM);
  // The angle at the shoulder between the line to the wrist and the upper arm.
  const cosine = (UPPER_ARM ** 2 + reach ** 2 - FOREARM ** 2) / (2 * UPPER_ARM * reach);
  const offset = Math.acos(Math.min(1, Math.max(-1, cosine)));
  const towardsWrist = Math.atan2(dy, dx);
  // Image y grows downwards, so adding the offset turns the elbow towards the feet and floor.
  const angle = towardsWrist + offset;
  return {
    x: shoulder.x + UPPER_ARM * Math.cos(angle),
    y: shoulder.y + UPPER_ARM * Math.sin(angle),
  };
}

function place(landmarks: Landmark[], name: LandmarkName, point: { x: number; y: number }): void {
  const current = landmarks[LANDMARK[name]];
  if (current) landmarks[LANDMARK[name]] = { ...current, x: point.x, y: point.y };
}
