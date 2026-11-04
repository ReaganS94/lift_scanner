import type { PoseFrame } from '../core';
import { median } from '../signal';
import { averagePoint, HIPS, SHOULDERS } from './landmark-points';
import { length, subtract } from './vector';

/**
 * The lifter's torso length (shoulders to hips) in the frame: the median over all frames, so a
 * few bad detections don't move it. Movements are divided by this so thresholds work at any
 * camera distance. Null if the torso was never seen.
 */
export function torsoLength(frames: readonly PoseFrame[]): number | null {
  const lengths = frames.map((frame) => {
    const shoulders = averagePoint(frame, SHOULDERS);
    const hips = averagePoint(frame, HIPS);
    if (!shoulders || !hips) return null;
    return length(subtract(shoulders, hips));
  });

  const value = median(lengths);
  return value !== null && value > 0 ? value : null;
}
