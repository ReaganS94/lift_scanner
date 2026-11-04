/** One repetition, as frame indices into the clip's PoseSequence. */
export interface Rep {
  /** 0-based position of the rep in the set. */
  readonly index: number;
  /** The last frame at the rest position before the rep. */
  readonly startFrame: number;
  /**
   * Where the movement reverses, furthest from rest: the bottom of a squat, the bar on the chest
   * in a bench press, lockout at the top of a deadlift.
   */
  readonly turnFrame: number;
  /** The first frame back at the rest position. */
  readonly endFrame: number;
}

/**
 * Tuning for rep detection. The rep signal is measured in torso lengths (shoulder to hip), so
 * these values don't depend on how far the camera is from the lifter.
 */
export interface RepDetectionOptions {
  /** The smallest movement, in torso lengths, that counts as a rep. */
  readonly minAmplitude: number;
  /** The shortest rep, in seconds. Anything quicker is treated as noise. */
  readonly minDurationSeconds: number;
}
