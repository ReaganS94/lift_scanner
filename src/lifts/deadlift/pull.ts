import type { BodySide, LandmarkName, PoseFrame, RepContext } from '../../core';
import {
  averagePoint,
  forwardTilt,
  sidePoint,
  SHOULDERS,
  WRISTS,
  type Facing,
} from '../../geometry';
import type { IndexedFrame } from '../../signal';

/** The bar counts as off the floor once the tracked points have risen this far, in torso lengths. */
const LIFTOFF_TORSOS = 0.05;
/**
 * How far before the rep's first frame to look for the floor. A rep starts at its last frame
 * near rest, and for a deadlift that can already be a little way off the floor.
 */
const FLOOR_LOOKBACK_SECONDS = 1;
/**
 * The hands follow the bar when they're seen in at least this share of the rep's frames.
 * Otherwise, as when the plates hide them in a side view, the shoulders stand in for them. The
 * knees are compared against the hands when they're seen in this share of the pull's frames.
 */
const HANDS_SEEN_SHARE = 0.8;
/**
 * When the hands and knees are both seen, the bar reaches the knees when the hands do.
 * Otherwise it is taken to reach them once the tracked points have covered this share of their
 * rise from the floor to lockout: for a conventional pull the hands pass the knees about a
 * third of the way up, and so do the shoulders when the hips and shoulders rise together. It is
 * only an estimate (with the hips set higher the hands pass the knees later), which is why the
 * knees are used whenever they're seen.
 */
const KNEE_HEIGHT_SHARE_OF_RISE = 1 / 3;
/**
 * A pull from the floor raises the hands or shoulders at least this far, in torso lengths:
 * about a torso length for a conventional pull, a bit less for sumo. Less than this and the bar
 * started above the knees, as in a rack pull.
 */
const FLOOR_PULL_MIN_RISE_TORSOS = 0.5;

/** Which points follow the bar for one rep. */
export type BarTracker = 'hands' | 'shoulders';

/** What the deadlift checks share about one rep's pull, from the floor to lockout. */
export interface Pull {
  /**
   * The frames from the last one with the bar on the floor up to lockout, each with its index
   * in the clip.
   */
  readonly frames: readonly IndexedFrame[];
  /** Which way the lifter faces. At the floor the hands and shoulders are ahead of the hips. */
  readonly facing: Facing;
  /** Position in `frames` where the bar has left the floor: always 1. */
  readonly liftoff: number;
  /**
   * Position in `frames` where the bar reaches about knee height, or null if the pull started
   * above the knees or the tracked points weren't seen getting there.
   */
  readonly kneeHeight: number | null;
  /** The points that followed the bar in this rep. */
  readonly tracker: BarTracker;
  /** The tracked points' height with the bar on the floor (image y): their lowest before the rep. */
  readonly floorY: number;
}

/** The pull of one deadlift rep, or null if the bar or hips weren't followed from the floor. */
export function pullOf(context: RepContext): Pull | null {
  const { rep, sequence, torsoLength, nearSide } = context;
  const lookbackStart = Math.max(
    0,
    rep.startFrame - Math.round(FLOOR_LOOKBACK_SECONDS * sequence.sampleFps),
  );
  const heightsOf = (names: readonly LandmarkName[]) =>
    sequence.frames.map((frame) => averagePoint(frame, names)?.y ?? null);

  const handsY = heightsOf(WRISTS);
  const repHands = handsY.slice(rep.startFrame, rep.endFrame + 1);
  const handsSeen = repHands.filter((y) => y !== null).length / Math.max(1, repHands.length);
  const tracker: BarTracker = handsSeen >= HANDS_SEEN_SHARE ? 'hands' : 'shoulders';
  const trackedY = tracker === 'hands' ? handsY : heightsOf(SHOULDERS);

  const lookback = trackedY.slice(lookbackStart, rep.startFrame + 1);
  const floorY = maxOf(lookback);
  if (floorY === null) return null;
  const riseAt = (index: number): number | null => {
    const y = trackedY[index];
    return y === null || y === undefined ? null : (floorY - y) / torsoLength;
  };

  const lastOnFloor =
    tracker === 'hands'
      ? lastOnFloorBefore(rep.turnFrame, lookbackStart, riseAt)
      : lastOnFloorAfter(lookbackStart + lookback.indexOf(floorY), rep.turnFrame, riseAt);
  const frames: IndexedFrame[] = [];
  for (let index = lastOnFloor; index >= 0 && index <= rep.turnFrame; index++) {
    const frame = sequence.frames[index];
    if (frame) frames.push({ frame, index });
  }
  const first = frames[0];
  const startBar = first && averagePoint(first.frame, tracker === 'hands' ? WRISTS : SHOULDERS);
  const startHip = first && sidePoint(first.frame, nearSide, 'Hip');
  if (frames.length < 2 || !startBar || !startHip) return null;

  const facing: Facing = startBar.x >= startHip.x ? 1 : -1;
  const liftoff = 1;
  const topRise = riseAt(rep.turnFrame) ?? 0;
  const kneesSeen =
    frames.filter(({ frame }) => sidePoint(frame, nearSide, 'Knee') !== null).length /
    frames.length;
  const reachesKnees = (frame: PoseFrame, index: number): boolean => {
    if (tracker === 'hands' && kneesSeen >= HANDS_SEEN_SHARE) {
      const hands = averagePoint(frame, WRISTS);
      const knee = sidePoint(frame, nearSide, 'Knee');
      return hands !== null && knee !== null && hands.y <= knee.y;
    }
    const rise = riseAt(index);
    return rise !== null && rise >= topRise * KNEE_HEIGHT_SHARE_OF_RISE;
  };
  const kneeHeight =
    topRise < FLOOR_PULL_MIN_RISE_TORSOS
      ? -1
      : frames.findIndex(({ frame, index }, i) => i >= liftoff && reachesKnees(frame, index));
  return {
    frames,
    facing,
    liftoff,
    kneeHeight: kneeHeight < 0 ? null : kneeHeight,
    tracker,
    floorY,
  };
}

/**
 * Following the hands: the last frame on the floor, searching back from lockout. Searching
 * back skips a dip-and-rip setup, where the hips move but the bar stays down.
 */
function lastOnFloorBefore(
  turnFrame: number,
  lookbackStart: number,
  riseAt: (index: number) => number | null,
): number {
  for (let index = turnFrame; index >= lookbackStart; index--) {
    const rise = riseAt(index);
    if (rise !== null && rise < LIFTOFF_TORSOS) return index;
  }
  return -1;
}

/**
 * Following the shoulders: the frame before they first leave the floor, searching forward from
 * their lowest point. Searching back would be fooled by hips shooting up, which keeps the
 * shoulders low (or even drops them) after the bar has left the floor.
 */
function lastOnFloorAfter(
  floorFrame: number,
  turnFrame: number,
  riseAt: (index: number) => number | null,
): number {
  let last = floorFrame;
  for (let index = floorFrame; index <= turnFrame; index++) {
    const rise = riseAt(index);
    if (rise === null) continue;
    if (rise >= LIFTOFF_TORSOS) return last;
    last = index;
  }
  return -1;
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
