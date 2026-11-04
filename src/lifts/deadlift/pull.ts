import type { BodySide, PoseFrame, RepContext } from '../../core';
import { averagePoint, forwardTilt, sidePoint, WRISTS, type Facing } from '../../geometry';
import type { IndexedFrame } from '../../signal';

/** The bar counts as off the floor once the hands have risen this far, in torso lengths. */
const LIFTOFF_TORSOS = 0.05;
/**
 * How far before the rep's first frame to look for the floor. A rep starts at its last frame
 * near rest, and for a deadlift that can already be a little way off the floor.
 */
const FLOOR_LOOKBACK_SECONDS = 1;

/** What the deadlift checks share about one rep's pull, from the floor to lockout. */
export interface Pull {
  /**
   * The frames from the last one with the bar on the floor up to lockout, each with its index
   * in the clip.
   */
  readonly frames: readonly IndexedFrame[];
  /** Which way the lifter faces. At the floor the hands are ahead of the hips. */
  readonly facing: Facing;
  /** Position in `frames` where the bar has left the floor: always 1. */
  readonly liftoff: number;
  /** Position in `frames` where the hands first reach knee height, or null if never seen. */
  readonly kneeHeight: number | null;
  /** The hands' height with the bar on the floor (image y): their lowest before the rep. */
  readonly floorHandsY: number;
}

/** Whether the hands are still at the floor in this frame, or null if they weren't seen. */
export function handsAtFloor(frame: PoseFrame, pull: Pull, torsoLength: number): boolean | null {
  const hands = averagePoint(frame, WRISTS);
  if (!hands) return null;
  return isAtFloor(hands.y, pull.floorHandsY, torsoLength);
}

/** The pull of one deadlift rep, or null if the hands or hips weren't seen at the floor. */
export function pullOf(context: RepContext): Pull | null {
  const { rep, sequence, torsoLength, nearSide } = context;
  const lookbackStart = Math.max(
    0,
    rep.startFrame - Math.round(FLOOR_LOOKBACK_SECONDS * sequence.sampleFps),
  );
  const handsY = sequence.frames.map((frame) => averagePoint(frame, WRISTS)?.y ?? null);
  const floorHandsY = maxOf(handsY.slice(lookbackStart, rep.startFrame + 1));
  if (floorHandsY === null) return null;

  // The pull starts at the last frame on the floor before lockout.
  let lastOnFloor = -1;
  for (let index = rep.turnFrame; index >= lookbackStart; index--) {
    const y = handsY[index];
    if (y !== null && y !== undefined && isAtFloor(y, floorHandsY, torsoLength)) {
      lastOnFloor = index;
      break;
    }
  }
  const frames: IndexedFrame[] = [];
  for (let index = lastOnFloor; index >= 0 && index <= rep.turnFrame; index++) {
    const frame = sequence.frames[index];
    if (frame) frames.push({ frame, index });
  }
  const first = frames[0];
  const startHands = first && averagePoint(first.frame, WRISTS);
  const startHip = first && sidePoint(first.frame, nearSide, 'Hip');
  if (frames.length < 2 || !startHands || !startHip) return null;

  const facing: Facing = startHands.x >= startHip.x ? 1 : -1;
  const liftoff = 1;
  const kneeHeight = frames.findIndex(({ frame }, i) => {
    if (i < liftoff) return false;
    const hands = averagePoint(frame, WRISTS);
    const knee = sidePoint(frame, nearSide, 'Knee');
    return hands !== null && knee !== null && hands.y <= knee.y;
  });
  return { frames, facing, liftoff, kneeHeight: kneeHeight < 0 ? null : kneeHeight, floorHandsY };
}

function isAtFloor(handsY: number, floorHandsY: number, torsoLength: number): boolean {
  // y grows downwards, so hands above the floor have a smaller y.
  return (floorHandsY - handsY) / torsoLength < LIFTOFF_TORSOS;
}

function maxOf(values: readonly (number | null)[]): number | null {
  const seen = values.filter((value): value is number => value !== null);
  return seen.length > 0 ? Math.max(...seen) : null;
}

/** Degrees the torso leans forward from the hip, on one side. Negative leans back. */
export function torsoLean(frame: PoseFrame, side: BodySide, facing: Facing): number | null {
  const hip = sidePoint(frame, side, 'Hip');
  const shoulder = sidePoint(frame, side, 'Shoulder');
  return hip && shoulder ? forwardTilt(hip, shoulder, facing) : null;
}
