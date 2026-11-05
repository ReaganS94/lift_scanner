import type { ClipContext, FormCheck } from './check';
import type { RepDetectionOptions } from './rep';
import type { View } from './view';

/** Everything the pipeline needs to analyse one kind of lift. One per folder in src/lifts/. */
export interface LiftDefinition {
  /** Stable identifier, e.g. 'squat'. */
  readonly id: string;
  /** Name shown to the user, e.g. 'Back squat'. */
  readonly name: string;
  readonly supportedViews: readonly View[];
  /**
   * One number per frame: how far the lifter is from their rest position, in torso lengths.
   * Null where it can't be measured.
   *
   * The rest position is where the lifter waits between reps: standing for a squat, arms locked
   * out for a bench press, and bar on the floor for a deadlift. So the signal is near 0 at rest
   * and peaks once per rep at the turning point, whether the lift starts at the top (squat,
   * bench) or the bottom (deadlift).
   */
  repSignal(clip: ClipContext): (number | null)[];
  readonly repDetection: RepDetectionOptions;
  readonly checks: readonly FormCheck[];
  /**
   * Whether to follow the bar's end (the near plate) through the clip while the poses are
   * found. It costs a little extra time per frame, so only lifts whose checks use it ask.
   */
  readonly followsBar?: boolean;
  /** Filming advice for this lift, shown after the general tips. Each entry is one sentence or two. */
  readonly filmingTips?: readonly string[];
}
