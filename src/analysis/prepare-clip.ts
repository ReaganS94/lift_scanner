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

/** Step 2: cleans the raw poses and guesses the camera view for the user to confirm. */
export function prepareClip(raw: PoseSequence): PreparedClip {
  const sequence = cleanPoses(raw);
  return {
    sequence,
    torsoLength: torsoLength(sequence.frames),
    nearSide: nearSide(sequence.frames),
    viewGuess: detectView(sequence),
  };
}
