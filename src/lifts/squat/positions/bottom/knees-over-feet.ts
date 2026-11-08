import {
  PHOTO_FRAME,
  type BodySide,
  type CheckResult,
  type PhotoContext,
  type PositionCheck,
} from '../../../../core';
import { sidePoint } from '../../../../geometry';

/**
 * Each knee's distance from the middle of the stance, as a share of its ankle's distance from
 * it. At 1 the knee is straight above the ankle; above 1 it's pushed out past it, as it should
 * be with the toes turned out. A knee this far in from its ankle or less still passes, to
 * allow for the model's wobble (about 5% of a typical stance).
 */
const PASS_FROM_SHARE = 0.9;
/** A knee further in than this share of its ankle's distance is a fail. */
const WARN_FROM_SHARE = 0.75;
/** With the feet closer than this, in torso lengths, small knee movements look huge. */
const MIN_ANKLE_GAP_TORSOS = 0.2;

const ID = 'squat.bottom.knees-over-feet';

/**
 * Knees caving in, from a front or back photo of the bottom. A video compares each rep with
 * standing; a photo has nothing to compare with, so each knee is judged against its own ankle:
 * at the bottom the knees should be at least as wide as the feet. Each knee is judged on its
 * own, so one knee caving shows even when the other is pushed out.
 */
export const kneesOverFeet: PositionCheck = {
  id: ID,
  label: 'Knees over feet',
  supportedViews: ['front', 'back'],
  focus: ['hip', 'knee', 'ankle'],
  evaluate({ pose, torsoLength }: PhotoContext): CheckResult {
    const left = legPoints(pose, 'left');
    const right = legPoints(pose, 'right');
    if (!left || !right) {
      return {
        checkId: ID,
        status: 'skipped',
        message: "The knees or ankles weren't seen clearly.",
      };
    }
    const middle = (left.ankle.x + right.ankle.x) / 2;
    const ankleGap = Math.abs(left.ankle.x - right.ankle.x);
    if (ankleGap < MIN_ANKLE_GAP_TORSOS * torsoLength) {
      return {
        checkId: ID,
        status: 'skipped',
        message: 'The feet are too close together to judge the knees.',
      };
    }

    const share = ({ knee, ankle }: LegPoints) =>
      ((knee.x - middle) * Math.sign(ankle.x - middle)) / Math.abs(ankle.x - middle);
    const shares = { left: share(left), right: share(right) };
    const worstSide: BodySide = shares.left <= shares.right ? 'left' : 'right';
    const worst = shares[worstSide];
    const measured = { checkId: ID, value: worst, frameIndex: PHOTO_FRAME };

    if (worst >= PASS_FROM_SHARE) {
      return {
        ...measured,
        status: 'pass',
        message:
          Math.min(shares.left, shares.right) >= 1
            ? 'Both knees are pushed out over or past the feet.'
            : 'Both knees are in line with the feet.',
      };
    }
    const bothIn = Math.max(shares.left, shares.right) < PASS_FROM_SHARE;
    return {
      ...measured,
      status: worst < WARN_FROM_SHARE ? 'fail' : 'warn',
      message: bothIn
        ? 'Both knees are inside the feet: they’re caving in.'
        : `The knee on the ${photoSide(worstSide === 'left' ? left : right, middle)} of the photo is inside its foot: it’s caving in.`,
    };
  },
};

interface LegPoints {
  readonly knee: { readonly x: number };
  readonly ankle: { readonly x: number };
}

/**
 * Which side of the photo a leg is on. Named by the photo rather than by the body, because the
 * model's left and right aren't reliable from behind.
 */
function photoSide({ ankle }: LegPoints, middle: number): 'left' | 'right' {
  return ankle.x < middle ? 'left' : 'right';
}

function legPoints(pose: PhotoContext['pose'], side: BodySide): LegPoints | null {
  const knee = sidePoint(pose, side, 'Knee');
  const ankle = sidePoint(pose, side, 'Ankle');
  return knee && ankle ? { knee, ankle } : null;
}
