/** One repetition, as frame indices into a PoseSequence. */
export interface Rep {
  /** 0-based position of the rep in the set. */
  readonly index: number;
  readonly startFrame: number;
  /** The turning point of the rep, e.g. the bottom of a squat or the bar touching the chest. */
  readonly turnFrame: number;
  readonly endFrame: number;
}
