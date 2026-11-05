import { LANDMARK, type Landmark, type PoseFrame } from '../core';

/** One person in one frame. */
export interface Sighting {
  readonly frameIndex: number;
  /** Which of the frame's people it is (an index into PoseFrame.people). */
  readonly personIndex: number;
  /** The middle of the torso, in the shared unit (frame heights). */
  readonly centre: { readonly x: number; readonly y: number };
  /** Shoulders to hips, in frame heights. Stays the same however the person bends. */
  readonly torso: number;
}

/** The same person followed across frames. */
export interface PersonTrack {
  readonly sightings: readonly Sighting[];
}

/** A person unseen for longer than this is taken to have left. */
const MAX_GAP_SECONDS = 0.5;
/**
 * How fast a torso can move, in its own lengths per second. Brisk walking is about three; a
 * lift moves the torso's middle less than that. Anything faster is a different person.
 */
const MAX_TORSOS_PER_SECOND = 6;
/** Extra room for the model's jitter, in torso lengths. */
const JITTER_TORSOS = 0.3;
/**
 * Two people in one frame closer than this, in torso lengths, are one person found twice (the
 * pose adapter may look with more than one copy of the model). The first listed is kept.
 */
const SAME_PERSON_TORSOS = 0.5;

/** Everyone in a frame: its people, or its one pose for data from before people were kept. */
export function peopleIn(frame: PoseFrame): readonly (readonly Landmark[])[] {
  if (frame.people) return frame.people;
  return frame.landmarks ? [frame.landmarks] : [];
}

/**
 * Links the people found in each frame into tracks, one per person, by joining each sighting
 * to the nearest track that could have moved there since it was last seen.
 */
export function linkPeople(frames: readonly PoseFrame[], sampleFps: number): PersonTrack[] {
  const maxGapFrames = Math.round(MAX_GAP_SECONDS * sampleFps);
  const tracks: Sighting[][] = [];

  frames.forEach((frame, frameIndex) => {
    const sightings: Sighting[] = [];
    peopleIn(frame).forEach((person, personIndex) => {
      const sighting = sight(person, frameIndex, personIndex);
      if (sighting && !sightings.some((kept) => samePerson(kept, sighting))) {
        sightings.push(sighting);
      }
    });

    // Every possible pairing of a live track with a sighting it could have moved to.
    const pairs: { track: Sighting[]; sighting: Sighting; distance: number }[] = [];
    for (const track of tracks) {
      const last = track[track.length - 1];
      if (!last) continue;
      const gap = frameIndex - last.frameIndex;
      if (gap > maxGapFrames) continue;
      for (const sighting of sightings) {
        const distance = Math.hypot(
          sighting.centre.x - last.centre.x,
          sighting.centre.y - last.centre.y,
        );
        const reach = last.torso * (JITTER_TORSOS + (MAX_TORSOS_PER_SECOND * gap) / sampleFps);
        if (distance <= reach) pairs.push({ track, sighting, distance });
      }
    }

    // Closest pairs first, each track and sighting used once.
    pairs.sort((a, b) => a.distance - b.distance);
    const usedTracks = new Set<Sighting[]>();
    const usedSightings = new Set<Sighting>();
    for (const { track, sighting } of pairs) {
      if (usedTracks.has(track) || usedSightings.has(sighting)) continue;
      track.push(sighting);
      usedTracks.add(track);
      usedSightings.add(sighting);
    }
    for (const sighting of sightings) {
      if (!usedSightings.has(sighting)) tracks.push([sighting]);
    }
  });

  return tracks.map((sightings) => ({ sightings }));
}

function samePerson(a: Sighting, b: Sighting): boolean {
  const apart = Math.hypot(a.centre.x - b.centre.x, a.centre.y - b.centre.y);
  return apart < SAME_PERSON_TORSOS * Math.max(a.torso, b.torso);
}

function sight(
  person: readonly Landmark[],
  frameIndex: number,
  personIndex: number,
): Sighting | null {
  const points = [
    person[LANDMARK.leftShoulder],
    person[LANDMARK.rightShoulder],
    person[LANDMARK.leftHip],
    person[LANDMARK.rightHip],
  ];
  const [leftShoulder, rightShoulder, leftHip, rightHip] = points;
  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return null;

  // Positions, not visibility: the model places hidden points too, near enough to follow.
  const shoulders = middle(leftShoulder, rightShoulder);
  const hips = middle(leftHip, rightHip);
  const torso = Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y);
  if (torso === 0) return null;
  return { frameIndex, personIndex, centre: middle(shoulders, hips), torso };
}

function middle(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
