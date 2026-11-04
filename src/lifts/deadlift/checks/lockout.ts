import type { CheckResult, FormCheck, PoseFrame, RepContext } from '../../../core';
import { forwardTilt, sidePoint, type Facing } from '../../../geometry';
import { repFrames } from '../../../signal';
import { pullOf, torsoLean } from '../pull';

/**
 * Bend left at the hips or knees at the top, in degrees, that still counts as locked out. Some
 * allowance is needed: the model's joint points don't line up perfectly even standing straight.
 * Leaning back at the top counts as locked out.
 */
const PASS_UP_TO_DEGREES = 10;
/** More bend than this is a fail; between the two is a warning. */
const WARN_UP_TO_DEGREES = 20;
/** Lockout is looked for within this long either side of where the bar was highest. */
const TOP_WINDOW_SECONDS = 0.25;

const ID = 'deadlift.lockout';

/** Full lockout: hips and knees straight at the top of the rep. */
export const lockout: FormCheck = {
  id: ID,
  label: 'Lockout',
  supportedViews: ['side'],
  evaluate(context: RepContext): CheckResult {
    const pull = pullOf(context);
    if (!pull) return skipped("The hands or hips weren't seen clearly at the floor.");

    const window = TOP_WINDOW_SECONDS * context.sequence.sampleFps;
    let best: { hips: number; knees: number; frameIndex: number } | null = null;
    for (const { frame, index } of repFrames(context)) {
      if (Math.abs(index - context.rep.turnFrame) > window) continue;
      const bends = bendsAt(frame, context, pull.facing);
      if (!bends) continue;
      if (best === null || Math.max(bends.hips, bends.knees) < Math.max(best.hips, best.knees)) {
        best = { ...bends, frameIndex: index };
      }
    }
    if (!best) return skipped("The hips or knees weren't seen clearly at the top.");

    const hips = Math.max(0, Math.round(best.hips));
    const knees = Math.max(0, Math.round(best.knees));
    const worst = Math.max(hips, knees);
    const measured = {
      checkId: ID,
      value: Math.max(best.hips, best.knees),
      frameIndex: best.frameIndex,
    };
    if (worst <= PASS_UP_TO_DEGREES) {
      return { ...measured, status: 'pass', message: 'Hips and knees locked out.' };
    }
    return {
      ...measured,
      status: worst <= WARN_UP_TO_DEGREES ? 'warn' : 'fail',
      message: shortfallMessage(hips, knees),
    };
  },
};

/**
 * How bent the near-side hip and knee are, in degrees (0 is straight, negative is bent back).
 * Signed tilts are used rather than joint angles, so leaning back at the top isn't mistaken
 * for a hip that hasn't straightened.
 */
function bendsAt(
  frame: PoseFrame,
  context: RepContext,
  facing: Facing,
): { hips: number; knees: number } | null {
  const hip = sidePoint(frame, context.nearSide, 'Hip');
  const knee = sidePoint(frame, context.nearSide, 'Knee');
  const ankle = sidePoint(frame, context.nearSide, 'Ankle');
  const torso = torsoLean(frame, context.nearSide, facing);
  if (!hip || !knee || !ankle || torso === null) return null;
  const thigh = forwardTilt(hip, knee, facing);
  const shin = forwardTilt(knee, ankle, facing);
  if (thigh === null || shin === null) return null;
  return { hips: torso + thigh, knees: thigh - shin };
}

function shortfallMessage(hips: number, knees: number): string {
  const short = (degrees: number) => degrees > PASS_UP_TO_DEGREES;
  if (short(hips) && short(knees)) {
    return `Hips stayed ${String(hips)}° and knees ${String(knees)}° short of locked out.`;
  }
  return short(hips)
    ? `Hips stayed ${String(hips)}° short of locked out.`
    : `Knees stayed ${String(knees)}° bent at the top.`;
}

function skipped(message: string): CheckResult {
  return { checkId: ID, status: 'skipped', message };
}
