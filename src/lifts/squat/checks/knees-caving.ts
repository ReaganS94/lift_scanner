import type { CheckResult, FormCheck, PoseFrame, RepContext } from '../../../core';
import { sidePoint } from '../../../geometry';
import { median, repFrames } from '../../../signal';

/** The start of the rep, standing, that gives the knee gap to compare against. */
const STANDING_SECONDS = 0.2;
/** With the feet closer than this, in torso lengths, small knee movements look huge. */
const MIN_ANKLE_GAP_TORSOS = 0.2;
/** The knee gap may narrow by up to this fraction of its standing width and still pass. */
const PASS_UP_TO = 0.1;
/** Narrowing by more than this fraction is a fail; between the two is a warning. */
const WARN_UP_TO = 0.2;

const ID = 'squat.knees-caving';

/**
 * Knees caving in, seen from the front or back. The gap between the knees, as a share of the
 * gap between the ankles, is compared with what it was standing at the start of the rep.
 * Comparing with the lifter's own start means a wide or narrow stance doesn't matter.
 */
export const kneesCaving: FormCheck = {
  id: ID,
  label: 'Knees caving in',
  supportedViews: ['front', 'back'],
  evaluate(context: RepContext): CheckResult {
    const frames = repFrames(context);
    const standingFrames = Math.max(1, Math.round(STANDING_SECONDS * context.sequence.sampleFps));
    const standing = frames.slice(0, standingFrames).map(({ frame }) => gaps(frame));
    const standingKneeShare = median(standing.map((g) => (g ? g.knees / g.ankles : null)));
    const standingAnkles = median(standing.map((g) => g?.ankles ?? null));

    if (standingKneeShare === null || standingAnkles === null) {
      return skipped("The knees or ankles weren't seen clearly at the start of this rep.");
    }
    if (standingAnkles < MIN_ANKLE_GAP_TORSOS * context.torsoLength) {
      return skipped('The feet are too close together to judge the knees.');
    }

    let narrowest: { share: number; frameIndex: number } | null = null;
    for (const { frame, index } of frames) {
      const g = gaps(frame);
      if (!g) continue;
      const share = g.knees / g.ankles;
      if (narrowest === null || share < narrowest.share) narrowest = { share, frameIndex: index };
    }
    // The standing frames were measured, so the loop found at least one.
    if (!narrowest) return skipped("The knees or ankles weren't seen clearly in this rep.");

    const narrowing = Math.max(0, 1 - narrowest.share / standingKneeShare);
    const percent = Math.round(narrowing * 100);
    const measured = { checkId: ID, value: narrowing, frameIndex: narrowest.frameIndex };
    if (narrowing <= PASS_UP_TO) {
      return { ...measured, status: 'pass', message: 'Knees held their width.' };
    }
    return {
      ...measured,
      status: narrowing <= WARN_UP_TO ? 'warn' : 'fail',
      message: `Knees caved in: the gap between them narrowed by ${String(percent)}%.`,
    };
  },
};

/** The side-to-side gaps between the knees and between the ankles, or null if any is unseen. */
function gaps(frame: PoseFrame): { knees: number; ankles: number } | null {
  const leftKnee = sidePoint(frame, 'left', 'Knee');
  const rightKnee = sidePoint(frame, 'right', 'Knee');
  const leftAnkle = sidePoint(frame, 'left', 'Ankle');
  const rightAnkle = sidePoint(frame, 'right', 'Ankle');
  if (!leftKnee || !rightKnee || !leftAnkle || !rightAnkle) return null;
  const ankles = Math.abs(leftAnkle.x - rightAnkle.x);
  if (ankles === 0) return null;
  return { knees: Math.abs(leftKnee.x - rightKnee.x), ankles };
}

function skipped(message: string): CheckResult {
  return { checkId: ID, status: 'skipped', message };
}
