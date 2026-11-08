import type {
  BarPoint,
  BodySide,
  CheckResult,
  FormCheck,
  PoseFrame,
  RepContext,
} from '../../../core';
import { trustedPlates } from '../../../bar';
import { forwardTilt, sidePoint, type Facing } from '../../../geometry';
import { repFrames } from '../../../signal';
import { hiddenByPlate, platesOnTheBar } from '../hidden-by-plate';
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

/**
 * Full lockout: hips and knees straight at the top of the rep.
 *
 * Filmed from the side, the near plate covers the knees at the top, so the knee point is only
 * a guess. Then the knees aren't judged, and the hips are measured against the line from hip to
 * ankle instead of the thigh: with the knees straight the two are the same line.
 *
 * Any plate the tracker was sure of counts here (see trustedPlates), even when it wasn't found
 * for enough of the rep to follow the bar: the plate only needs to be seen at the top to hide
 * the knees there. It must have risen with the bar (see platesOnTheBar), so a round outline
 * that isn't the bar can't hide them.
 */
export const lockout: FormCheck = {
  id: ID,
  label: 'Lockout',
  supportedViews: ['side'],
  focus: ['shoulder', 'hip', 'knee', 'ankle'],
  evaluate(context: RepContext): CheckResult {
    const pull = pullOf(context);
    if (!pull) return skipped("The bar or hips weren't followed clearly from the floor.");

    const window = TOP_WINDOW_SECONDS * context.sequence.sampleFps;
    const plates = platesOnTheBar(context, trustedPlates(context.sequence.barTrack ?? []));
    let best: (Bends & { frameIndex: number }) | null = null;
    for (const { frame, index } of repFrames(context)) {
      if (Math.abs(index - context.rep.turnFrame) > window) continue;
      const bends = bendsAt(frame, context.nearSide, pull.facing, plates[index]);
      if (!bends) continue;
      // Measuring both joints beats measuring only the hips; then the least bent moment wins.
      const better =
        best === null ||
        (bends.knees !== null && best.knees === null) ||
        ((bends.knees === null) === (best.knees === null) && worstOf(bends) < worstOf(best));
      if (better) best = { ...bends, frameIndex: index };
    }
    if (!best) return skipped("The hips or legs weren't seen clearly at the top.");

    return {
      checkId: ID,
      value: worstOf(best),
      frameIndex: best.frameIndex,
      ...lockoutVerdict(best),
    };
  },
};

/** How a lockout's bends are judged, shared with the lockout photo check. */
export function lockoutVerdict(bends: Bends): {
  status: 'pass' | 'warn' | 'fail';
  message: string;
} {
  const hips = Math.max(0, Math.round(bends.hips));
  const knees = bends.knees === null ? null : Math.max(0, Math.round(bends.knees));
  const worst = Math.max(hips, knees ?? 0);
  const kneesNote =
    bends.kneeHidden === 'plate'
      ? ' Your knees were behind the plate, so only the hips were checked.'
      : bends.kneeHidden === 'unseen'
        ? ' Your knees weren’t seen clearly, so only the hips were checked.'
        : '';
  if (worst <= PASS_UP_TO_DEGREES) {
    return {
      status: 'pass',
      message: (knees === null ? 'Hips locked out.' : 'Hips and knees locked out.') + kneesNote,
    };
  }
  return {
    status: worst <= WARN_UP_TO_DEGREES ? 'warn' : 'fail',
    message: shortfallMessage(hips, knees) + kneesNote,
  };
}

export interface Bends {
  readonly hips: number;
  /** Null when the knee was hidden, so it wasn't measured. */
  readonly knees: number | null;
  /** Why the knee wasn't measured, or null when it was. */
  readonly kneeHidden: 'plate' | 'unseen' | null;
}

/** The bigger of the two bends, in degrees. */
export function worstOf(bends: Bends): number {
  return Math.max(bends.hips, bends.knees ?? -Infinity);
}

/**
 * How bent the near-side hip and knee are, in degrees (0 is straight, negative is bent back).
 * Signed tilts are used rather than joint angles, so leaning back at the top isn't mistaken
 * for a hip that hasn't straightened. Without a knee that can be seen, the hip is measured
 * against the hip-to-ankle line and the knee isn't measured.
 */
export function bendsAt(
  frame: PoseFrame,
  side: BodySide,
  facing: Facing,
  plate: BarPoint | null | undefined,
): Bends | null {
  const hip = sidePoint(frame, side, 'Hip');
  const ankle = sidePoint(frame, side, 'Ankle');
  const torso = torsoLean(frame, side, facing);
  if (!hip || !ankle || torso === null) return null;

  const knee = sidePoint(frame, side, 'Knee');
  const kneeHidden = !knee ? 'unseen' : hiddenByPlate(knee, plate) ? 'plate' : null;
  if (!knee || kneeHidden) {
    const leg = forwardTilt(hip, ankle, facing);
    return leg === null ? null : { hips: torso + leg, knees: null, kneeHidden };
  }
  const thigh = forwardTilt(hip, knee, facing);
  const shin = forwardTilt(knee, ankle, facing);
  if (thigh === null || shin === null) return null;
  return { hips: torso + thigh, knees: thigh - shin, kneeHidden: null };
}

function shortfallMessage(hips: number, knees: number | null): string {
  const short = (degrees: number | null) => degrees !== null && degrees > PASS_UP_TO_DEGREES;
  if (short(hips) && knees !== null && short(knees)) {
    return `Hips stayed ${String(hips)}° and knees ${String(knees)}° short of locked out.`;
  }
  return short(hips)
    ? `Hips stayed ${String(hips)}° short of locked out.`
    : `Knees stayed ${String(knees ?? 0)}° bent at the top.`;
}

function skipped(message: string): CheckResult {
  return { checkId: ID, status: 'skipped', message };
}
