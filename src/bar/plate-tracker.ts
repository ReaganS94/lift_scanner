import type { BarPoint, FrameRegion, GrayImage, LandmarkName, PoseFrame } from '../core';
import { averagePoint, HIPS, pointAt, SHOULDERS } from '../geometry';
import { median } from '../signal';
import { findCircle, type Circle } from './find-circle';

/** Reads part of the current frame at the given scale; see RegionReader in core. */
export type ReadRegion = (region: FrameRegion, pixelsPerUnit: number) => GrayImage;

/** Follows the near plate from frame to frame. Create one per clip. */
export interface PlateTracker {
  /** The plate in this frame, or null while it hasn't been found. Call once per frame, in order. */
  track(pose: PoseFrame, read: ReadRegion): BarPoint | null;
}

/**
 * Pictures are read at a scale that makes the plate about this many pixels in radius: enough
 * for its centre to be placed within a few millimetres, while keeping each frame's search fast.
 */
const PLATE_RADIUS_PX = 24;

/**
 * Sizes of plate to look for, in torso lengths. A full-size 45 cm plate is about 0.45 torso
 * lengths across its radius when the camera is a few metres away. The plate is nearer the
 * camera than the lifter, so with the camera close it looks bigger: about 0.85 in a clip
 * filmed from about 1.5 m at floor level. Smaller plates go down to about 0.3.
 */
const SEED_MIN_RADIUS_TORSOS = 0.3;
const SEED_MAX_RADIUS_TORSOS = 1.3;
/** The radius the scale is chosen for while looking for the plate the first time. */
const SEED_EXPECTED_RADIUS_TORSOS = 0.6;
/**
 * Where to look for the plate the first time, around the middle of the feet: the bar sits over
 * the middle of the foot, its centre a plate's radius above the floor, a little above the
 * ankles. Generous, since the plate's size depends on the camera, and so that a bar set down a
 * little ahead or behind is still found.
 */
const SEED_ABOVE_ANKLE_TORSOS = 0.4;
const SEED_HALF_WIDTH_TORSOS = 1.3;
const SEED_HALF_HEIGHT_TORSOS = 1;
/**
 * At least this much of the plate's edge must be seen to take it as the plate the first time.
 * High, because curved outlines such as a bent leg can look like part of a circle.
 */
const SEED_MIN_SCORE = 0.65;
/**
 * The plate is only taken as found once it is seen in the same place this many frames in a row,
 * so a round shape seen once in passing isn't mistaken for it.
 */
const SEED_FRAMES = 3;
/** How far apart the seed sightings may be, in torso lengths, and still count as the same. */
const SEED_AGREEMENT_TORSOS = 0.1;

/**
 * How far the plate is looked for from where it was in the last frame, in torso lengths. A fast
 * pull moves the bar about 2 m/s, which is under 0.15 torso lengths a frame at 30 fps.
 */
const TRACK_REACH_TORSOS = 0.3;
/** Each frame missed widens the search by this much, in torso lengths. */
const TRACK_REACH_PER_MISS_TORSOS = 0.1;
/**
 * The plate's size changes little: it is looked for at the size it was first found at, give or
 * take this share. Always the first size, so small errors can't add up frame after frame.
 */
const TRACK_RADIUS_TOLERANCE = 0.15;
/** Less of the edge than this and the frame counts as missed: motion blur or something in front. */
const TRACK_MIN_SCORE = 0.3;
/** After this many missed frames in a row the plate is looked for afresh, as at the start. */
export const MAX_MISSES = 15;
/** Torso lengths are steadied with a median over this many recent frames. */
const TORSO_HISTORY = 15;

/**
 * A tracker for the near plate, the end of the bar, in a side-on clip.
 *
 * It first looks around the near foot, where the bar sits on the floor, using the pose to know
 * where that is and how big a plate should look. Once found, the plate is followed by looking
 * for a circle of the same size close to where it was. Frames where it isn't found come back
 * null rather than guessed.
 */
export function createPlateTracker(aspectRatio: number): PlateTracker {
  const torsoHistory: number[] = [];
  let seeds: BarPoint[] = [];
  let last: BarPoint | null = null;
  /** The plate's radius when it was first found, kept until it is lost. */
  let plateRadius = 0;
  let misses = 0;

  const torsoOf = (pose: PoseFrame): number | null => {
    const shoulders = averagePoint(pose, SHOULDERS);
    const hips = averagePoint(pose, HIPS);
    if (shoulders && hips) {
      torsoHistory.push(Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y));
      if (torsoHistory.length > TORSO_HISTORY) torsoHistory.shift();
    }
    return median(torsoHistory);
  };

  const seed = (pose: PoseFrame, torso: number, read: ReadRegion): BarPoint | null => {
    const feet = feetOf(pose);
    if (!feet) {
      seeds = [];
      return null;
    }
    const centre = { x: (feet.left + feet.right) / 2, y: feet.y - SEED_ABOVE_ANKLE_TORSOS * torso };
    const found = search(read, aspectRatio, {
      centre,
      halfWidth: (feet.right - feet.left) / 2 + SEED_HALF_WIDTH_TORSOS * torso,
      halfHeight: SEED_HALF_HEIGHT_TORSOS * torso,
      expectedRadius: SEED_EXPECTED_RADIUS_TORSOS * torso,
      minRadius: SEED_MIN_RADIUS_TORSOS * torso,
      maxRadius: SEED_MAX_RADIUS_TORSOS * torso,
    });
    if (!found || found.confidence < SEED_MIN_SCORE) {
      seeds = [];
      return null;
    }

    const previous = seeds[seeds.length - 1];
    const agrees =
      !previous ||
      (Math.hypot(found.x - previous.x, found.y - previous.y) <= SEED_AGREEMENT_TORSOS * torso &&
        Math.abs(found.radius - previous.radius) <= TRACK_RADIUS_TOLERANCE * previous.radius);
    seeds = agrees ? [...seeds, found] : [found];
    return seeds.length >= SEED_FRAMES ? found : null;
  };

  const follow = (from: BarPoint, torso: number, read: ReadRegion): BarPoint | null => {
    const reach = (TRACK_REACH_TORSOS + misses * TRACK_REACH_PER_MISS_TORSOS) * torso;
    const found = search(read, aspectRatio, {
      centre: from,
      halfWidth: plateRadius + reach,
      halfHeight: plateRadius + reach,
      expectedRadius: plateRadius,
      minRadius: plateRadius * (1 - TRACK_RADIUS_TOLERANCE),
      maxRadius: plateRadius * (1 + TRACK_RADIUS_TOLERANCE),
    });
    return found && found.confidence >= TRACK_MIN_SCORE ? found : null;
  };

  return {
    track(pose, read) {
      const torso = torsoOf(pose);
      if (torso === null) return null;

      if (!last) {
        const found = seed(pose, torso, read);
        if (found) {
          plateRadius = median(seeds.map((sighting) => sighting.radius)) ?? found.radius;
          last = found;
          seeds = [];
          misses = 0;
        }
        return found;
      }

      const found = follow(last, torso, read);
      if (found) {
        last = found;
        misses = 0;
        return found;
      }
      misses++;
      if (misses > MAX_MISSES) {
        last = null;
        misses = 0;
      }
      return null;
    },
  };
}

interface Search {
  readonly centre: { readonly x: number; readonly y: number };
  readonly halfWidth: number;
  readonly halfHeight: number;
  /** The radius the picture's scale is chosen for. */
  readonly expectedRadius: number;
  readonly minRadius: number;
  readonly maxRadius: number;
}

/** Looks for the plate in one region of the frame. Sizes are in the shared unit. */
function search(read: ReadRegion, aspectRatio: number, request: Search): BarPoint | null {
  const region = clampToFrame(
    {
      x: request.centre.x - request.halfWidth,
      y: request.centre.y - request.halfHeight,
      width: 2 * request.halfWidth,
      height: 2 * request.halfHeight,
    },
    aspectRatio,
  );
  if (!region || request.expectedRadius <= 0) return null;

  const pixelsPerUnit = PLATE_RADIUS_PX / request.expectedRadius;
  const image = read(region, pixelsPerUnit);
  if (image.width < 3 || image.height < 3) return null;
  // The reader rounds the picture's size, so the true scale is taken from what came back.
  const scale = image.width / region.width;
  const circle: Circle | null = findCircle(image, {
    minRadius: request.minRadius * scale,
    maxRadius: request.maxRadius * scale,
  });
  if (!circle) return null;
  // Pixel n covers n to n + 1, so its centre is half a pixel in.
  return {
    x: region.x + (circle.x + 0.5) / scale,
    y: region.y + (circle.y + 0.5) / scale,
    radius: circle.radius / scale,
    confidence: circle.score,
  };
}

function clampToFrame(region: FrameRegion, aspectRatio: number): FrameRegion | null {
  const left = Math.max(0, region.x);
  const top = Math.max(0, region.y);
  const right = Math.min(aspectRatio, region.x + region.width);
  const bottom = Math.min(1, region.y + region.height);
  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * How far the feet reach across the frame, from the middles of whichever feet are seen (each
 * from its ankle and toes, or the ankle alone), and the ankles' height. In a side view the two
 * feet overlap; from an angle the bar sits between them. Null if no ankle is seen.
 */
function feetOf(pose: PoseFrame): { left: number; right: number; y: number } | null {
  const sides: readonly [LandmarkName, LandmarkName][] = [
    ['leftAnkle', 'leftFootIndex'],
    ['rightAnkle', 'rightFootIndex'],
  ];
  const middles: { x: number; y: number }[] = [];
  for (const [ankleName, toesName] of sides) {
    const ankle = pointAt(pose, ankleName);
    if (!ankle) continue;
    const toes = pointAt(pose, toesName);
    middles.push({ x: toes ? (ankle.x + toes.x) / 2 : ankle.x, y: ankle.y });
  }
  if (middles.length === 0) return null;
  const xs = middles.map((middle) => middle.x);
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    y: Math.max(...middles.map((middle) => middle.y)),
  };
}
