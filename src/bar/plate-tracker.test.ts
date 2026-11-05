import { describe, expect, it } from 'vitest';
import { LANDMARK, type BarPoint, type Landmark, type PoseFrame } from '../core';
import {
  between,
  DEADLIFT_LOCKOUT,
  DEADLIFT_SETUP,
  DEADLIFT_TORSO,
  sideDeadliftFigure,
} from '../testing/deadlift-pose';
import { readScene, type Disk, type SceneOptions } from '../testing/plate-scene';
import { PORTRAIT_ASPECT, setVisibility } from '../testing/synthetic-pose';
import { createPlateTracker } from './plate-tracker';

/** A 20 kg plate is 45 cm across; a torso is about 50 cm. */
const PLATE_RADIUS = 0.45 * DEADLIFT_TORSO;

/** The plate's centre, on the bar, for a lifter in this pose: the bar is at the hands. */
function plateFor(landmarks: readonly Landmark[], radius = PLATE_RADIUS): Disk {
  const wrist = landmarks[LANDMARK.leftWrist];
  if (!wrist) throw new Error('No wrist');
  return { x: wrist.x, y: wrist.y, radius };
}

/** Runs a tracker over frames of a pull from the floor to lockout, `count` frames long. */
function trackPull(
  count: number,
  options: SceneOptions & { hidePlate?: (frame: number) => boolean; radius?: number } = {},
): { found: (BarPoint | null)[]; truth: Disk[] } {
  const tracker = createPlateTracker(PORTRAIT_ASPECT);
  const found: (BarPoint | null)[] = [];
  const truth: Disk[] = [];
  for (let frame = 0; frame < count; frame++) {
    // A few frames at the floor first, as when a set starts.
    const t = Math.max(0, (frame - 5) / (count - 6));
    const landmarks = sideDeadliftFigure(between(DEADLIFT_SETUP, DEADLIFT_LOCKOUT, t));
    const plate = plateFor(landmarks, options.radius);
    const pose: PoseFrame = { timeMs: frame * 33, landmarks };
    const hidden = options.hidePlate?.(frame) ?? false;
    truth.push(plate);
    found.push(
      tracker.track(pose, (region, ppu) =>
        readScene(hidden ? null : plate, region, ppu, { ...options, seed: frame + 1 }),
      ),
    );
  }
  return { found, truth };
}

describe('createPlateTracker', () => {
  it('finds the plate by the foot after a few frames and follows it to lockout', () => {
    const { found, truth } = trackPull(40);
    expect(found.slice(0, 2)).toEqual([null, null]);
    for (let frame = 2; frame < 40; frame++) {
      const point = found[frame];
      const plate = truth[frame];
      expect(point, `frame ${String(frame)}`).not.toBeNull();
      if (!point || !plate) continue;
      // Within 1% of the frame height: about 5 mm on a lifter filling half the picture.
      expect(Math.abs(point.x - plate.x)).toBeLessThan(0.01);
      expect(Math.abs(point.y - plate.y)).toBeLessThan(0.01);
      expect(point.radius / PLATE_RADIUS).toBeCloseTo(1, 1);
    }
  });

  it('finds a plate that looks big because the camera is close and low', () => {
    // In a clip filmed from about 1.5 m at floor level the plate's radius was 0.85 torsos.
    const radius = 0.85 * DEADLIFT_TORSO;
    const { found, truth } = trackPull(30, { radius });
    const point = found[29];
    const plate = truth[29];
    expect(point?.radius).toBeCloseTo(radius, 2);
    expect(Math.abs((point?.x ?? 0) - (plate?.x ?? 1))).toBeLessThan(0.01);
  });

  it('follows the plate through sensor noise', () => {
    const { found, truth } = trackPull(40, { noise: 15 });
    const errors = found
      .map(
        (point, i) => point && truth[i] && Math.hypot(point.x - truth[i].x, point.y - truth[i].y),
      )
      .filter((error): error is number => typeof error === 'number');
    expect(errors.length).toBeGreaterThanOrEqual(36);
    expect(Math.max(...errors)).toBeLessThan(0.01);
  });

  it('reports frames where the plate is hidden as not found, then picks it up again', () => {
    const { found } = trackPull(40, { hidePlate: (frame) => frame >= 15 && frame < 19 });
    expect(found.slice(15, 19)).toEqual([null, null, null, null]);
    expect(found[19]).not.toBeNull();
    expect(found[39]).not.toBeNull();
  });

  it('finds nothing when there is no plate', () => {
    const { found } = trackPull(20, { hidePlate: () => true });
    expect(found.every((point) => point === null)).toBe(true);
  });

  it('keeps the plate at the size it was found at, so errors cannot add up', () => {
    const { found } = trackPull(60, { noise: 15 });
    const radii = found.filter((point) => point !== null).map((point) => point.radius);
    expect(Math.min(...radii) / PLATE_RADIUS).toBeGreaterThan(0.85);
    expect(Math.max(...radii) / PLATE_RADIUS).toBeLessThan(1.15);
  });

  it("doesn't take part of a curved outline by the feet for the plate", () => {
    // A dark half-disk, like the curve of a bent leg, where the plate would be.
    const tracker = createPlateTracker(PORTRAIT_ASPECT);
    const landmarks = sideDeadliftFigure(DEADLIFT_SETUP);
    const plate = plateFor(landmarks);
    const found = Array.from({ length: 10 }, (_, frame) =>
      tracker.track({ timeMs: frame * 33, landmarks }, (region, ppu) =>
        readScene(null, region, ppu, {
          distractors: [
            { ...plate, shade: 30 },
            // The background covering the left half of it.
            { x: plate.x - 10, y: plate.y, radius: 10, shade: 170 },
          ],
        }),
      ),
    );
    expect(found.every((point) => point === null)).toBe(true);
  });

  it('takes the near plate over the far one, as when filmed from an angle', () => {
    // The far plate is smaller, further back and higher, and its edge is clearer: dark on the
    // floor, where the near plate's is faint, as when hands and legs cross it.
    const tracker = createPlateTracker(PORTRAIT_ASPECT);
    const landmarks = sideDeadliftFigure(DEADLIFT_SETUP);
    const near = plateFor(landmarks);
    const far = {
      x: near.x - 0.7 * near.radius,
      y: near.y - 0.6 * near.radius,
      radius: 0.65 * near.radius,
      shade: 0,
    };
    const found = Array.from({ length: 6 }, (_, frame) =>
      tracker.track({ timeMs: frame * 33, landmarks }, (region, ppu) =>
        readScene(near, region, ppu, { plate: 110, distractors: [far] }),
      ),
    );
    const point = found[5];
    expect(point?.radius).toBeCloseTo(near.radius, 2);
    expect(Math.abs((point?.x ?? 0) - near.x)).toBeLessThan(0.01);
  });

  it('finds the plate when it hides the ankles, from the knees', () => {
    const tracker = createPlateTracker(PORTRAIT_ASPECT);
    const landmarks = sideDeadliftFigure(DEADLIFT_SETUP);
    for (const name of ['leftAnkle', 'rightAnkle', 'leftFootIndex', 'rightFootIndex'] as const) {
      setVisibility(landmarks, name, 0);
    }
    const plate = plateFor(landmarks);
    const found = Array.from({ length: 6 }, (_, frame) =>
      tracker.track({ timeMs: frame * 33, landmarks }, (region, ppu) =>
        readScene(plate, region, ppu),
      ),
    );
    expect(Math.abs((found[5]?.x ?? 0) - plate.x)).toBeLessThan(0.01);
  });
});
