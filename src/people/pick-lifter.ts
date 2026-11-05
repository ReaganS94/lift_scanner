import type { PoseFrame, PoseSequence } from '../core';
import { median, percentile } from '../signal';
import { linkPeople, peopleIn, type PersonTrack, type Sighting } from './link-people';

/**
 * A broken-off piece of track is the lifter too if its middle is within this many torso lengths
 * of the lifter's usual place, and its torso is about the lifter's size (so not someone further
 * back walking past behind them). The model sometimes loses the lifter for a moment, often
 * while they're bent over the bar.
 */
const REJOIN_TORSOS = 1.5;
const REJOIN_SIZE_RATIO = 1.3;

/**
 * Picks the lifter out of everyone the pose model found, and makes them the pose of every
 * frame. Frames where the lifter wasn't found get no pose, even if someone else was there:
 * measuring the wrong person is worse than measuring nobody.
 *
 * The lifter is the person who, over the whole clip, is
 * - there the longest: people walking past leave within seconds,
 * - biggest: the phone is set up close to the lifter, so others are further away,
 * - staying put: a lift happens in one place, while others in a gym walk, lunge or push sleds.
 */
export function pickLifter(sequence: PoseSequence): PoseSequence {
  const ranked = linkPeople(sequence.frames, sequence.sampleFps)
    .map((track) => ({ track, score: lifterScore(track) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ track }) => track);

  const lifterIn = new Map<number, number>();
  const [best, ...rest] = ranked;
  if (best) {
    const home = usualPlace(best.sightings);
    for (const track of [best, ...rest]) {
      const place = usualPlace(track.sightings);
      const apart = Math.hypot(place.x - home.x, place.y - home.y);
      const sizeRatio = Math.max(place.torso, home.torso) / Math.min(place.torso, home.torso);
      const overlaps = track.sightings.some((sighting) => lifterIn.has(sighting.frameIndex));
      const rejoins =
        !overlaps && apart <= REJOIN_TORSOS * home.torso && sizeRatio <= REJOIN_SIZE_RATIO;
      if (track !== best && !rejoins) continue;
      for (const sighting of track.sightings) {
        lifterIn.set(sighting.frameIndex, sighting.personIndex);
      }
    }
  }

  const frames = sequence.frames.map((frame, frameIndex): PoseFrame => {
    const personIndex = lifterIn.get(frameIndex);
    const landmarks = personIndex === undefined ? null : (peopleIn(frame)[personIndex] ?? null);
    return { ...frame, landmarks };
  });
  return { ...sequence, frames };
}

/**
 * Bigger for the more likely lifter: how long the person was there, times the torso's size, less
 * the more they wander sideways. Sideways only, since a lift moves the torso up and down.
 *
 * How long is the time from first to last sighting, not the number of sightings: the person the
 * pose adapter's tracker follows is seen in every frame, everyone else only when its finder
 * looks (one frame in five), and that mustn't hand the tracked person the win.
 */
export function lifterScore(track: PersonTrack): number {
  const { sightings } = track;
  const first = sightings[0];
  const last = sightings[sightings.length - 1];
  const { torso } = usualPlace(sightings);
  if (!first || !last || torso === 0) return 0;
  const frames = last.frameIndex - first.frameIndex + 1;
  // The middle 80%, so walking in at the start or out at the end doesn't count against them.
  const xs = sightings.map((sighting) => sighting.centre.x);
  const wander = (percentile(xs, 0.9) ?? 0) - (percentile(xs, 0.1) ?? 0);
  return (frames * torso) / (1 + wander / torso);
}

/** Where a track's torso usually is, and its usual length. */
function usualPlace(sightings: readonly Sighting[]) {
  return {
    x: median(sightings.map((sighting) => sighting.centre.x)) ?? 0,
    y: median(sightings.map((sighting) => sighting.centre.y)) ?? 0,
    torso: median(sightings.map((sighting) => sighting.torso)) ?? 0,
  };
}
