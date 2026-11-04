/**
 * Builders for synthetic squats, for tests only. The figure matches standingFigure(): a torso
 * of 0.25 (shoulder to hip), a thigh of 0.18 and a shin of 0.2, in frame heights.
 */
import { LANDMARK, type Landmark, type LandmarkName, type RepContext, type View } from '../core';
import { moved, repWave, sequenceOf, standingFigure, UPPER_BODY } from './synthetic-pose';

export const SQUAT_TORSO = 0.25;
const THIGH = 0.18;
const DEGREES = Math.PI / 180;

export interface SideSquatPosition {
  /** Degrees the thigh sits below parallel: -90 standing, 0 parallel, positive below. */
  readonly thighBelowParallel: number;
  /** Degrees the torso leans forward from vertical. */
  readonly torsoLean: number;
}

/**
 * A lifter seen from their left side, facing the image's right. The knees and feet stay put.
 * Every point above the knees moves with the hips, so the head and arms follow the torso.
 */
export function sideSquatFigure(position: SideSquatPosition): Landmark[] {
  const standing = standingFigure('side');
  const knee = pointOf(standing, 'leftKnee');
  const standingHip = pointOf(standing, 'leftHip');
  const standingShoulder = pointOf(standing, 'leftShoulder');

  const thigh = position.thighBelowParallel * DEGREES;
  const hip = { x: knee.x - THIGH * Math.cos(thigh), y: knee.y + THIGH * Math.sin(thigh) };
  const lean = position.torsoLean * DEGREES;
  const shoulder = {
    x: hip.x + SQUAT_TORSO * Math.sin(lean),
    y: hip.y - SQUAT_TORSO * Math.cos(lean),
  };

  const hips: readonly LandmarkName[] = ['leftHip', 'rightHip'];
  const aboveHips = UPPER_BODY.filter((name) => !hips.includes(name));
  const withHips = moved(standing, hips, hip.x - standingHip.x, hip.y - standingHip.y);
  return moved(
    withHips,
    aboveHips,
    shoulder.x - standingShoulder.x,
    shoulder.y - standingShoulder.y,
  );
}

/**
 * A lifter seen from the front, with the hips dropped by `drop` torso lengths and the knees
 * `kneeGap` apart. Standing, the knees and ankles are both 0.14 apart.
 */
export function frontSquatFigure(drop: number, kneeGap: number): Landmark[] {
  const standing = standingFigure('front');
  const lowered = moved(standing, UPPER_BODY, 0, drop * SQUAT_TORSO);
  const change = (kneeGap - 0.14) / 2;
  // In a front view the lifter's left knee is on the image's right.
  return moved(moved(lowered, ['leftKnee'], change, 0), ['rightKnee'], -change, 0);
}

function pointOf(landmarks: readonly Landmark[], name: LandmarkName): { x: number; y: number } {
  const point = landmarks[LANDMARK[name]];
  if (!point) throw new Error(`No ${name} in the figure`);
  return point;
}

const REST_FRAMES = 10;
const REP_FRAMES = 60;

/**
 * One squat rep from standing to `bottom` and back, with rest either side, ready to hand to a
 * check. The bottom is at frame 40. `edit` can change any frame, for example to hide a point.
 */
export function sideSquatRep(
  bottom: SideSquatPosition,
  edit: (landmarks: Landmark[], frameIndex: number) => Landmark[] = (landmarks) => landmarks,
): RepContext {
  const frames = squatWave().map((t, index) =>
    edit(
      sideSquatFigure({
        thighBelowParallel: -90 + t * (bottom.thighBelowParallel + 90),
        torsoLean: 5 + t * (bottom.torsoLean - 5),
      }),
      index,
    ),
  );
  return repContext(frames, 'side');
}

/** Like sideSquatRep(), seen from the front, with the knees `bottomKneeGap` apart at the bottom. */
export function frontSquatRep(
  bottomKneeGap: number,
  edit: (landmarks: Landmark[], frameIndex: number) => Landmark[] = (landmarks) => landmarks,
): RepContext {
  const frames = squatWave().map((t, index) =>
    edit(frontSquatFigure(0.8 * t, 0.14 + t * (bottomKneeGap - 0.14)), index),
  );
  return repContext(frames, 'front');
}

/** 0 standing to 1 at the bottom and back, with rest either side. */
function squatWave(): number[] {
  return repWave({ reps: 1, repFrames: REP_FRAMES, restFrames: REST_FRAMES, amplitude: 1 });
}

function repContext(frames: readonly Landmark[][], view: View): RepContext {
  return {
    sequence: sequenceOf(frames),
    view,
    torsoLength: SQUAT_TORSO,
    nearSide: 'left',
    rep: {
      index: 0,
      startFrame: REST_FRAMES - 1,
      turnFrame: REST_FRAMES + REP_FRAMES / 2,
      endFrame: REST_FRAMES + REP_FRAMES,
    },
  };
}
