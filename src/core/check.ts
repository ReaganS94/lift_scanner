import type { PoseFrame } from './pose';
import type { Rep } from './rep';
import type { View } from './view';

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'skipped';

/** The outcome of one form check on one rep. */
export interface CheckResult {
  readonly checkId: string;
  readonly status: CheckStatus;
  /** Plain-language explanation, e.g. "Hip crease stayed above the knee". */
  readonly message: string;
  /** The measured number behind the result, e.g. a depth angle in degrees. */
  readonly value?: number;
  /** The frame to jump to in the video to see the issue. */
  readonly frameIndex?: number;
  /** Why the check couldn't run, e.g. "Needs a side view". Set when status is 'skipped'. */
  readonly skippedReason?: string;
}

/** Everything a check gets to look at for a single rep. */
export interface RepContext {
  readonly rep: Rep;
  readonly view: View;
  /** The frames of this rep only, from startFrame to endFrame inclusive. */
  readonly frames: readonly PoseFrame[];
}

/** One form rule for one lift. Each check lives in its own file under src/lifts/<lift>/checks/. */
export interface FormCheck {
  readonly id: string;
  /** Short name shown in the report, e.g. "Depth". */
  readonly label: string;
  /** Views this check gives trustworthy results for. It is skipped on any other view. */
  readonly supportedViews: readonly View[];
  evaluate(context: RepContext): CheckResult;
}
