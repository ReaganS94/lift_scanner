import type { BodySide, PoseSequence } from '../core';
import { nearSide, torsoLength } from '../geometry';
import { cleanPoses } from '../signal';
import { detectView, type ViewGuess } from '../view';

/** A clip ready for the user to confirm the camera view. */
export interface PreparedClip {
  /** The cleaned pose sequence that all later steps use. */
  readonly sequence: PoseSequence;
  /** Null when no torso was found, in which case the clip can't be analysed. */
  readonly torsoLength: number | null;
  readonly nearSide: BodySide;
  readonly viewGuess: ViewGuess;
}

/**
 * Step 2: cleans the raw poses and guesses the camera view for the user to confirm.
 *
 * The view and near side are judged from the raw poses: cleanup drops faint points, and in a
 * side view the far shoulder and hip are always faint, yet their rough positions and
 * visibility are exactly the evidence those two judgements need.
 */
export function prepareClip(raw: PoseSequence): PreparedClip {
  const sequence = cleanPoses(raw);
  return {
    sequence,
    torsoLength: torsoLength(sequence.frames),
    nearSide: nearSide(raw.frames),
    viewGuess: detectView(raw),
  };
}
