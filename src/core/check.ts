import type { PoseSequence } from './pose';
import type { BodyJoint, BodySide } from './landmarks';
import type { Rep } from './rep';
import type { View } from './view';

/** A check that ran and measured something. */
export interface MeasuredCheckResult {
  readonly checkId: string;
  readonly status: 'pass' | 'warn' | 'fail';
  /** Plain-language explanation, e.g. "Hip crease stayed above the knee". */
  readonly message: string;
  /** The measured number behind the result, e.g. a depth angle in degrees. */
  readonly value?: number;
  /**
   * The frame to jump to in the video to see the issue. An index into the whole clip's
   * PoseSequence, the same numbering as Rep.startFrame and Rep.endFrame.
   */
  readonly frameIndex?: number;
}

/** A check that couldn't be measured reliably on this rep, so it reports nothing. */
export interface SkippedCheckResult {
  readonly checkId: string;
  readonly status: 'skipped';
  /** Why the check couldn't run, e.g. "Needs a side view". */
  readonly message: string;
}

/** The outcome of one form check on one rep. Narrow on `status` to read measured fields. */
export type CheckResult = MeasuredCheckResult | SkippedCheckResult;

export type CheckStatus = CheckResult['status'];

/** What the pipeline knows about the whole clip once the view is confirmed. */
export interface ClipContext {
  /**
   * The whole clip, already cleaned. Every frame index anywhere in the app (reps, check
   * results) refers to this sequence.
   */
  readonly sequence: PoseSequence;
  /** The camera view the user confirmed. */
  readonly view: View;
  /** The lifter's torso length in the frame, for turning distances into body-relative units. */
  readonly torsoLength: number;
  /**
   * The side of the body the model saw more clearly. In a side view, measure this side: the far
   * side is partly hidden and its points are guesses.
   */
  readonly nearSide: BodySide;
  /**
   * Roughly how far the camera was turned away from side-on, in degrees (0 is side-on). For a
   * side view the analysis corrects the sequence for it before any check runs, so checks
   * needn't. Absent when unknown.
   */
  readonly angleFromSide?: number;
}

/** Everything a check gets to look at for a single rep. Read its frames from rep.startFrame to rep.endFrame. */
export interface RepContext extends ClipContext {
  readonly rep: Rep;
}

/** One form rule for one lift. Each check lives in its own file under src/lifts/<lift>/checks/. */
export interface FormCheck {
  readonly id: string;
  /** Short name shown in the report, e.g. "Depth". */
  readonly label: string;
  /** Views this check gives trustworthy results for. It is skipped on any other view. */
  readonly supportedViews: readonly View[];
  /**
   * The joints this check looks at, on both sides, so the app can highlight them on the video.
   * For display only: it doesn't change what the check measures.
   */
  readonly focus?: readonly BodyJoint[];
  evaluate(context: RepContext): CheckResult;
}
