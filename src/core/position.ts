import type { CheckResult } from './check';
import type { BodyJoint, BodySide } from './landmarks';
import type { PoseFrame } from './pose';
import type { View } from './view';

/**
 * What a position check gets to look at: the lifter's pose in one photo, once the camera view
 * is confirmed. A photo is analysed as a one-frame clip, so this mirrors ClipContext.
 */
export interface PhotoContext {
  /** The lifter's pose in the photo, already cleaned and corrected for the camera angle. */
  readonly pose: PoseFrame;
  /** The camera view the user confirmed. */
  readonly view: View;
  /** The lifter's torso length in the photo, for turning distances into body-relative units. */
  readonly torsoLength: number;
  /** The side of the body the model saw more clearly. Measure this side in a side view. */
  readonly nearSide: BodySide;
}

/** One form rule for one held position, judged from a single photo. */
export interface PositionCheck {
  readonly id: string;
  /** Short name shown in the report, e.g. "Depth". */
  readonly label: string;
  /** Views this check gives trustworthy results for. It is skipped on any other view. */
  readonly supportedViews: readonly View[];
  /** The joints this check looks at, for highlighting on the photo. Display only. */
  readonly focus: readonly BodyJoint[];
  evaluate(context: PhotoContext): CheckResult;
}

/**
 * A moment of a lift worth checking on its own from a photo, such as the bottom of a squat or
 * a deadlift setup. One file per position under src/lifts/<lift>/positions/.
 */
export interface LiftPosition {
  /** Stable identifier, unique across all lifts, e.g. 'squat.bottom'. */
  readonly id: string;
  /** Name shown to the user, e.g. 'Bottom'. */
  readonly name: string;
  /** One sentence on which moment to capture. */
  readonly description: string;
  readonly checks: readonly PositionCheck[];
}

/** A photo is analysed as a one-frame clip, so every measured photo result points at frame 0. */
export const PHOTO_FRAME = 0;
