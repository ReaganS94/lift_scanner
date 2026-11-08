import {
  PHOTO_FRAME,
  type BodySide,
  type CheckResult,
  type PhotoContext,
  type PositionCheck,
} from '../../../../core';
import { angleFromVertical, sidePoint, type Vec2 } from '../../../../geometry';

/**
 * Tilt of the forearm from vertical, in degrees, that still passes. Stacking the wrist over the
 * elbow at the bottom lets the arms push straight up; a little lean is normal and the model's
 * points wobble, so this only warns.
 */
const PASS_UP_TO_DEGREES = 15;

const ID = 'bench.bottom.forearms-vertical';

/**
 * Forearms vertical with the bar on the chest. From the side the near arm is measured, and the
 * lean is towards the head or the feet. From the head or feet both arms are measured, and the
 * lean is outwards (grip wider than the elbows) or inwards.
 */
export const forearmsVertical: PositionCheck = {
  id: ID,
  label: 'Forearms vertical',
  supportedViews: ['side', 'front', 'back'],
  focus: ['elbow', 'wrist'],
  evaluate(context: PhotoContext): CheckResult {
    const arms = context.view === 'side' ? sideArm(context) : frontArms(context);
    if (!arms) {
      return {
        checkId: ID,
        status: 'skipped',
        message: "The elbows or wrists weren't seen clearly.",
      };
    }

    const degrees = Math.round(arms.tilt);
    const measured = { checkId: ID, value: arms.tilt, frameIndex: PHOTO_FRAME };
    if (degrees <= PASS_UP_TO_DEGREES) {
      return { ...measured, status: 'pass', message: 'Wrists are stacked over the elbows.' };
    }
    return {
      ...measured,
      status: 'warn',
      message: `Forearms lean ${String(degrees)}° ${arms.towards}.`,
    };
  },
};

interface ArmLean {
  readonly tilt: number;
  readonly towards: string;
}

function forearm(pose: PhotoContext['pose'], side: BodySide) {
  const elbow = sidePoint(pose, side, 'Elbow');
  const wrist = sidePoint(pose, side, 'Wrist');
  const tilt = elbow && wrist ? angleFromVertical(elbow, wrist) : null;
  return elbow && wrist && tilt !== null ? { elbow, wrist, tilt } : null;
}

function sideArm({ pose, nearSide }: PhotoContext): ArmLean | null {
  const arm = forearm(pose, nearSide);
  const shoulder = sidePoint(pose, nearSide, 'Shoulder');
  const hip = sidePoint(pose, nearSide, 'Hip');
  if (!arm || !shoulder || !hip) return null;
  // Lying down, the head is the way the shoulder is from the hip.
  const towardsHead = (arm.wrist.x - arm.elbow.x) * (shoulder.x - hip.x) > 0;
  return {
    tilt: arm.tilt,
    towards: towardsHead
      ? 'towards your head: the wrists are behind the elbows'
      : 'towards your feet: the wrists are ahead of the elbows',
  };
}

function frontArms({ pose }: PhotoContext): ArmLean | null {
  const left = forearm(pose, 'left');
  const right = forearm(pose, 'right');
  if (!left || !right) return null;
  const middle = (left.elbow.x + right.elbow.x) / 2;
  const worst = left.tilt >= right.tilt ? left : right;
  return {
    tilt: worst.tilt,
    towards: outwards(worst, middle)
      ? 'outwards: the grip is wider than the elbows'
      : 'inwards: the grip is narrower than the elbows',
  };
}

function outwards({ elbow, wrist }: { elbow: Vec2; wrist: Vec2 }, middle: number): boolean {
  return (wrist.x - elbow.x) * (elbow.x - middle) > 0;
}
