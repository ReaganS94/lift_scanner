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
