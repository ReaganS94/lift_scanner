import type { FormCheck } from './check';
import type { PoseFrame } from './pose';
import type { View } from './view';

/** Everything the pipeline needs to analyse one kind of lift. One per folder in src/lifts/. */
export interface LiftDefinition {
  /** Stable identifier, e.g. 'squat'. */
  readonly id: string;
  /** Name shown to the user, e.g. 'Back squat'. */
  readonly name: string;
  readonly supportedViews: readonly View[];
  /**
   * A single number per frame that rises and falls once per rep, used to find the reps.
   * For a squat this could be hip height. Return null for frames where it can't be measured.
   */
  repSignal(frames: readonly PoseFrame[], view: View): (number | null)[];
  readonly checks: readonly FormCheck[];
}
