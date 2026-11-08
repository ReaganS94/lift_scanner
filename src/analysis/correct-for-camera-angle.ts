import {
  LANDMARK,
  type BarPoint,
  type ClipContext,
  type Landmark,
  type PoseSequence,
} from '../core';

/**
 * Past this many degrees off side-on the correction isn't stretched any further: the stretch
 * grows quickly (1.4 times at 45°, 2 times at 60°) and would blow up the model's jitter along
 * with the true movement. View detection stops calling a clip a side view past 45° anyway.
 */
export const MAX_CORRECTED_DEGREES = 45;

/** A side view with its camera angle corrected for (see correctForCameraAngle). */
export function correctedClip(clip: ClipContext): ClipContext {
  if (clip.view !== 'side' || clip.angleFromSide === undefined) return clip;
  return { ...clip, sequence: correctForCameraAngle(clip.sequence, clip.angleFromSide) };
}

/**
 * Undoes most of what an angled camera does to a side view, so side-view angles read close to
 * true.
 *
 * Squats, deadlifts and bench presses move in the plane that runs front to back through the
 * body. Filmed straight side-on, that plane faces the camera. With the camera turned `degrees`
 * away from side-on, distances along that plane's horizontal shrink to cos(degrees) of their
 * length in the image, while heights stay the same. So a 20° bend at the hips reads as only
 * 15° from 40° off, and a 55° forward lean as 47°. Stretching every frame sideways by
 * 1 / cos(degrees), about the middle of the hips, restores them.
 *
 * Only for side views: the stretch also spreads the near and far sides of the body apart,
 * which side-view checks don't measure (they use the near side). The bar's track is stretched
 * the same way, about the same point.
 */
export function correctForCameraAngle(sequence: PoseSequence, degrees: number): PoseSequence {
  const clamped = Math.min(Math.max(degrees, 0), MAX_CORRECTED_DEGREES);
  const stretch = 1 / Math.cos((clamped * Math.PI) / 180);
  if (stretch === 1) return sequence;

  const centres = sequence.frames.map((frame) => hipCentreX(frame.landmarks));
  const frames = sequence.frames.map((frame, index) => {
    const centre = centres[index];
    if (!frame.landmarks || centre === null || centre === undefined) return frame;
    const landmarks = frame.landmarks.map((landmark) => stretched(landmark, centre, stretch));
    return { ...frame, landmarks };
  });

  if (!sequence.barTrack) return { ...sequence, frames };
  const barTrack = sequence.barTrack.map((point, index): BarPoint | null => {
    const centre = centres[index];
    if (!point || centre === null || centre === undefined) return point;
    return stretched(point, centre, stretch);
  });
  return { ...sequence, frames, barTrack };
}

function stretched<T extends { readonly x: number }>(point: T, centre: number, stretch: number): T {
  return { ...point, x: centre + (point.x - centre) * stretch };
}

/** Midway between the hips. Both hips' positions are used even when faint: only x matters. */
function hipCentreX(landmarks: readonly Landmark[] | null): number | null {
  const left = landmarks?.[LANDMARK.leftHip];
  const right = landmarks?.[LANDMARK.rightHip];
  if (!left || !right) return null;
  return (left.x + right.x) / 2;
}
