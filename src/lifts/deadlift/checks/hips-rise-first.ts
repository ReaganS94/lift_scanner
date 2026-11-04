import type { CheckResult, FormCheck, RepContext } from '../../../core';
import { rollingMedian } from '../../../signal';
import { handsAtFloor, pullOf, torsoLean, type Pull } from '../pull';

/**
 * How much further forward the torso may tip between the set position and the hands reaching
 * the knees, in degrees. In a good pull the hips and shoulders rise together, so the torso
 * angle holds or gets more upright; hips shooting up first tip the chest towards the floor.
 */
const PASS_UP_TO_DEGREES = 10;
/** Tipping further than this is a fail; between the two is a warning. */
const WARN_UP_TO_DEGREES = 20;
/**
 * The set position is looked for in this much time before the bar leaves the floor. Hips that
 * shoot up often do so before the bar moves, so the bar leaving the floor is too late.
 */
const SETUP_SECONDS = 1;
/** Leans are steadied with a median over this long either side of each frame. */
const LEAN_WINDOW_SECONDS = 0.1;

const ID = 'deadlift.hips-rise-first';

/** Hips rising before the shoulders: the torso tipping forward on the way to the knees. */
export const hipsRiseFirst: FormCheck = {
  id: ID,
  label: 'Hips rising first',
  supportedViews: ['side'],
  evaluate(context: RepContext): CheckResult {
    const pull = pullOf(context);
    if (!pull) return skipped("The hands or hips weren't seen clearly at the floor.");
    if (pull.kneeHeight === null) {
      return skipped("The hands weren't seen reaching the knees in this rep.");
    }

    if (pull.kneeHeight <= pull.liftoff) {
      return skipped('The bar started above the knees, so there was no pull from the floor.');
    }

    const tip = tipFromSetup(context, pull, pull.kneeHeight);
    if (!tip) return skipped("The hip or shoulder wasn't seen clearly early in the pull.");

    const tipped = tip.degrees;
    const degrees = Math.round(tipped);
    const measured = { checkId: ID, value: tipped, frameIndex: tip.frameIndex };
    if (degrees <= PASS_UP_TO_DEGREES) {
      return {
        ...measured,
        status: 'pass',
        message: 'Hips and shoulders rose together off the floor.',
      };
    }
    return {
      ...measured,
      status: degrees <= WARN_UP_TO_DEGREES ? 'warn' : 'fail',
      message: `Hips rose first: the torso tipped ${String(degrees)}° further forward on the way to the knees.`,
    };
  },
};

/**
 * How far the torso tips forward from the set position on the way to the knees, in degrees,
 * and the frame where it is most tipped. The set position is the most upright the torso gets
 * while the hands are still at the floor, in the time before the bar leaves it; this can reach
 * back before the rep's first frame. Null if the torso wasn't seen at the floor.
 */
function tipFromSetup(
  context: RepContext,
  pull: Pull,
  kneeHeight: number,
): { degrees: number; frameIndex: number } | null {
  const fps = context.sequence.sampleFps;
  const liftoffIndex = pull.frames[pull.liftoff]?.index;
  const kneeIndex = pull.frames[kneeHeight]?.index;
  if (liftoffIndex === undefined || kneeIndex === undefined) return null;

  const from = Math.max(0, liftoffIndex - Math.round(SETUP_SECONDS * fps));
  const frames = context.sequence.frames.slice(from, kneeIndex + 1);
  const leans = rollingMedian(
    frames.map((frame) => torsoLean(frame, context.nearSide, pull.facing)),
    Math.round(LEAN_WINDOW_SECONDS * fps),
  );

  let setup: { lean: number; at: number } | null = null;
  for (let at = 0; at <= liftoffIndex - from; at++) {
    const lean = leans[at];
    const frame = frames[at];
    if (lean === null || lean === undefined || !frame) continue;
    if (!handsAtFloor(frame, pull, context.torsoLength)) continue;
    if (setup === null || lean < setup.lean) setup = { lean, at };
  }
  if (!setup) return null;

  let peak = setup;
  for (let at = setup.at; at < leans.length; at++) {
    const lean = leans[at];
    if (lean !== null && lean !== undefined && lean > peak.lean) peak = { lean, at };
  }
  return { degrees: peak.lean - setup.lean, frameIndex: from + peak.at };
}

function skipped(message: string): CheckResult {
  return { checkId: ID, status: 'skipped', message };
}
