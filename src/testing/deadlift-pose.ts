/**
 * Builders for synthetic deadlifts, for tests only. The lifter is seen from their left side,
 * facing the image's right. The bar stays over the middle of the foot unless told to drift, and
 * the arms reach down to it from the shoulders. Lengths are in frame heights and match
 * standingFigure(): a torso of 0.25, a thigh of 0.18 and a shin of 0.2.
 */
import { LANDMARK, type Landmark, type LandmarkName, type RepContext } from '../core';
import { repWave, sequenceOf, standingFigure, UPPER_BODY } from './synthetic-pose';

export const DEADLIFT_TORSO = 0.25;
const SHIN = 0.2;
const THIGH = 0.18;
const ARM = 0.3;
/** The middle of the foot, where the bar sits, is this far ahead of the ankle. */
const MID_FOOT = 0.03;
const DEGREES = Math.PI / 180;

/** Joint angles in degrees, each a tilt from vertical. All 0 is standing straight. */
export interface DeadliftPosition {
  /** The shin tipping forward: the knee ahead of the ankle. */
  readonly shin: number;
  /** The thigh tipping from vertical, with the hip behind the knee. */
  readonly thigh: number;
  /** The torso leaning forward from the hip. Negative leans back. */
  readonly torso: number;
  /** How far the bar has drifted forward of the middle of the foot, in frame heights. */
  readonly barAhead?: number;
}

/** Bar on the floor at mid-shin: knees bent and forward, hips back, shoulders over the bar. */
export const DEADLIFT_SETUP: DeadliftPosition = { shin: 25, thigh: 65, torso: 55 };
export const DEADLIFT_LOCKOUT: DeadliftPosition = { shin: 0, thigh: 0, torso: 0 };

/** The position a fraction `t` of the way from `from` to `to`. */
export function between(from: DeadliftPosition, to: DeadliftPosition, t: number): DeadliftPosition {
  const mix = (a: number, b: number) => a + (b - a) * t;
  return {
    shin: mix(from.shin, to.shin),
    thigh: mix(from.thigh, to.thigh),
    torso: mix(from.torso, to.torso),
    barAhead: mix(from.barAhead ?? 0, to.barAhead ?? 0),
  };
}

/** All 33 landmarks for a lifter in the given position. */
export function sideDeadliftFigure(position: DeadliftPosition): Landmark[] {
  const standing = standingFigure('side');
  const result = [...standing];
  const ankle = pointOf(standing, 'leftAnkle');
  const shin = position.shin * DEGREES;
  const thigh = position.thigh * DEGREES;
  const torso = position.torso * DEGREES;

  const knee = { x: ankle.x + SHIN * Math.sin(shin), y: ankle.y - SHIN * Math.cos(shin) };
  const hip = { x: knee.x - THIGH * Math.sin(thigh), y: knee.y - THIGH * Math.cos(thigh) };
  const shoulder = {
    x: hip.x + DEADLIFT_TORSO * Math.sin(torso),
    y: hip.y - DEADLIFT_TORSO * Math.cos(torso),
  };
  const barX = ankle.x + MID_FOOT + (position.barAhead ?? 0);
  const reach = barX - shoulder.x;
  const wrist = { x: barX, y: shoulder.y + Math.sqrt(ARM * ARM - reach * reach) };
  const elbow = { x: (shoulder.x + wrist.x) / 2, y: (shoulder.y + wrist.y) / 2 };

  // The head and face move with the shoulders.
  const standingShoulder = pointOf(standing, 'leftShoulder');
  const headShift = { x: shoulder.x - standingShoulder.x, y: shoulder.y - standingShoulder.y };
  const joints = new Set<LandmarkName>([
    'leftShoulder',
    'rightShoulder',
    'leftElbow',
    'rightElbow',
    'leftWrist',
    'rightWrist',
    'leftHip',
    'rightHip',
  ]);
  for (const name of UPPER_BODY) {
    if (joints.has(name)) continue;
    const point = pointOf(standing, name);
    place(result, name, { x: point.x + headShift.x, y: point.y + headShift.y });
  }

  const sides: readonly ['left' | 'right', number][] = [
    ['left', 0],
    ['right', -0.005], // the far side, just behind
  ];
  for (const [side, offset] of sides) {
    const shifted = (point: { x: number; y: number }) => ({ x: point.x + offset, y: point.y });
    place(result, `${side}Ankle`, shifted(ankle));
    place(result, `${side}Heel`, shifted({ x: ankle.x - 0.03, y: ankle.y + 0.02 }));
    place(result, `${side}FootIndex`, shifted({ x: ankle.x + 0.09, y: ankle.y + 0.03 }));
    place(result, `${side}Knee`, shifted(knee));
    place(result, `${side}Hip`, shifted(hip));
    place(result, `${side}Shoulder`, shifted(shoulder));
    place(result, `${side}Elbow`, shifted(elbow));
    place(result, `${side}Wrist`, shifted(wrist));
  }
  return result;
}

/**
 * One deadlift rep with rest at the floor either side, ready to hand to a check. `path` gives
 * the position for each point of the pull, from 0 (bar on the floor) to 1 (lockout); the
 * lowering retraces it. Lockout is at frame 40.
 */
export function sideDeadliftRep(
  path: (t: number) => DeadliftPosition = (t) => between(DEADLIFT_SETUP, DEADLIFT_LOCKOUT, t),
  edit: (landmarks: Landmark[], frameIndex: number) => Landmark[] = (landmarks) => landmarks,
): RepContext {
  const wave = repWave({ reps: 1, repFrames: 60, restFrames: 10, amplitude: 1 });
  const frames = wave.map((t, index) => edit(sideDeadliftFigure(path(t)), index));
  return {
    sequence: sequenceOf(frames),
    view: 'side',
    torsoLength: DEADLIFT_TORSO,
    nearSide: 'left',
    rep: { index: 0, startFrame: 9, turnFrame: 40, endFrame: 70 },
  };
}

function pointOf(landmarks: readonly Landmark[], name: LandmarkName): { x: number; y: number } {
  const point = landmarks[LANDMARK[name]];
  if (!point) throw new Error(`No ${name} in the figure`);
  return point;
}

function place(landmarks: Landmark[], name: LandmarkName, point: { x: number; y: number }): void {
  const current = landmarks[LANDMARK[name]];
  if (current) landmarks[LANDMARK[name]] = { ...current, x: point.x, y: point.y };
}
