/**
 * Following the bar itself, which the pose model doesn't see: the near plate's centre, found
 * as a circle in the frame. Pure: the frames are read through a RegionReader adapter.
 */
export { findCircle } from './find-circle';
export type { Circle, CircleSearch } from './find-circle';
export { createPlateTracker } from './plate-tracker';
export type { PlateTracker, ReadRegion } from './plate-tracker';
