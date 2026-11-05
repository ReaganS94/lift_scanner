/** One repetition, as frame indices into the clip's PoseSequence. */
export interface Rep {
  /** 0-based position of the rep in the set. */
  readonly index: number;
  /**
   * The last frame at the rest position before the rep (within 0.1 torso lengths of it), or
   * for a touch-and-go rep, the bottom of the bounce where the previous rep ended.
   */
  readonly startFrame: number;
  /**
   * Where the movement reverses, furthest from rest: the bottom of a squat, the bar on the chest
   * in a bench press, lockout at the top of a deadlift.
   */
  readonly turnFrame: number;
  /**
   * The first frame back at the rest position (within 0.1 torso lengths of it), or the bottom
   * of the bounce before a touch-and-go rep.
   */
  readonly endFrame: number;
}

/**
 * Tuning for rep detection. The rep signal is measured in torso lengths (shoulder to hip), so
 * these values don't depend on how far the camera is from the lifter.
 */
export interface RepDetectionOptions {
  /** The smallest movement, in torso lengths, that counts as a rep. Must be well above 0.1. */
  readonly minAmplitude: number;
  /** The shortest rep, in seconds. Anything quicker is treated as noise. */
  readonly minDurationSeconds: number;
  /**
   * When set, a rep must also travel at least this share of the way the set's biggest rep went.
   * For lifts whose torso can look short when filmed at an angle, which inflates the model's
   * wobble past minAmplitude. Leave unset where a short rep is a fault worth reporting, such as
   * a squat cut high.
   */
  readonly minShareOfBiggestRep?: number;
}
