import type { CheckResult, FormCheck, RepContext } from '../../../core';
import { rollingMedian } from '../../../signal';
import { pullOf, torsoLean, type Pull } from '../pull';

/**
 * How much further forward the torso may tip between the bar leaving the floor and the bar
 * reaching the knees, in degrees. In a good pull the hips and shoulders rise together, so the
 * torso angle holds or gets more upright; hips shooting up first tip the chest towards the floor.
 *
 * Hip movement before the bar leaves the floor isn't judged. Many lifters drop the hips and
 * rise into position as they take the slack out, and with only the hands to follow the bar
 * that looks the same as hips rising too early.
 *
 * When the plates hide the hands, the shoulders follow the bar instead (see pullOf). Hips
 * shooting up keep the shoulders low, so liftoff is then found a little late and some early
 * tipping can be missed: the check is more lenient, never harsher.
 */
const PASS_UP_TO_DEGREES = 10;
/** Tipping further than this is a fail; between the two is a warning. */
const WARN_UP_TO_DEGREES = 20;
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
    if (!pull) return skipped("The bar or hips weren't followed clearly from the floor.");
    if (pull.kneeHeight === null) {
      return skipped("The bar wasn't seen reaching the knees in this rep.");
    }

    if (pull.kneeHeight <= pull.liftoff) {
      return skipped('The bar started above the knees, so there was no pull from the floor.');
    }

    const tip = tipFromLiftoff(context, pull, pull.kneeHeight);
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
 * How far the torso tips forward from where it was as the bar left the floor, up to the bar
 * reaching the knees, in degrees, and the frame where it is most tipped. Null if the torso
 * wasn't seen at liftoff.
 */
function tipFromLiftoff(
  context: RepContext,
  pull: Pull,
  kneeHeight: number,
): { degrees: number; frameIndex: number } | null {
  const liftoffIndex = pull.frames[pull.liftoff]?.index;
  const kneeIndex = pull.frames[kneeHeight]?.index;
  if (liftoffIndex === undefined || kneeIndex === undefined) return null;

  const radius = Math.round(LEAN_WINDOW_SECONDS * context.sequence.sampleFps);
  const from = Math.max(0, liftoffIndex - radius);
  const frames = context.sequence.frames.slice(from, kneeIndex + radius + 1);
  const leans = rollingMedian(
    frames.map((frame) => torsoLean(frame, context.nearSide, pull.facing)),
    radius,
  );

  const atLiftoff = leans[liftoffIndex - from];
  if (atLiftoff === null || atLiftoff === undefined) return null;
  let peak = { lean: atLiftoff, at: liftoffIndex - from };
  for (let at = liftoffIndex - from; at <= kneeIndex - from; at++) {
    const lean = leans[at];
    if (lean !== null && lean !== undefined && lean > peak.lean) peak = { lean, at };
  }
  return { degrees: peak.lean - atLiftoff, frameIndex: from + peak.at };
}

function skipped(message: string): CheckResult {
  return { checkId: ID, status: 'skipped', message };
}
