/**
 * Where the end of the bar was found in one frame: the centre of the plate nearest the camera.
 * In the shared unit (see Landmark).
 *
 * The pose model tracks the body only, and from the side the near plate hides the hands, so
 * the plate is the most direct view of the bar a side-on clip gives.
 */
export interface BarPoint {
  readonly x: number;
  readonly y: number;
  /** The plate's radius, in the same unit. */
  readonly radius: number;
  /** How much of the plate's edge was found, 0 to 1. */
  readonly confidence: number;
}

/**
 * The plate is only trusted where, over a stretch of frames, a median of at least this share of
 * its edge was found. Filmed straight side-on the plate is a clean circle (a median of 0.83 on
 * Reagan's first gym clip). Filmed at an angle it is an oval, and the tracker can settle on part
 * of it, or on the far plate, and still rise with the bar (a median of 0.49 over the rep on a
 * clip about 35° off side-on), placing the bar wrongly.
 */
export const TRUSTED_PLATE_CONFIDENCE = 0.7;
