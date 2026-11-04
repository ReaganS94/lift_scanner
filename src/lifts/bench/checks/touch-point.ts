import type { CheckResult, FormCheck, PoseFrame, RepContext } from '../../../core';
import { sidePoint } from '../../../geometry';
import { median, repFrames } from '../../../signal';

/**
 * Where the bar touches is measured along the body, as a share of the way from the shoulder
 * joints (0) to the hip joints (1). The middle of the chest is about a third of the way.
 * Touching above this share is near the collarbones.
 */
const HIGH_BELOW = 0.15;
/** Touching below this share is towards the stomach. */
const LOW_ABOVE = 0.6;
/** The touch is the median over this long either side of where the hands were lowest. */
const TOUCH_WINDOW_SECONDS = 0.1;

const ID = 'bench.touch-point';

/**
 * Where the bar touches the chest, followed through the near-side wrist. This only warns:
 * the right spot depends on grip width and arch, so a touch outside the usual range is worth
 * a look rather than a fault.
 */
export const touchPoint: FormCheck = {
  id: ID,
  label: 'Touch point',
  supportedViews: ['side'],
  evaluate(context: RepContext): CheckResult {
    const radius = TOUCH_WINDOW_SECONDS * context.sequence.sampleFps;
    const near = repFrames(context).filter(
      ({ index }) => Math.abs(index - context.rep.turnFrame) <= radius,
    );
    const along = median(near.map(({ frame }) => shareAlongBody(frame, context)));
    if (along === null) {
      return {
        checkId: ID,
        status: 'skipped',
        message: "The wrist, shoulder or hip wasn't seen clearly at the bottom of this rep.",
      };
    }

    const measured = { checkId: ID, value: along, frameIndex: context.rep.turnFrame };
    if (along < HIGH_BELOW) {
      return {
        ...measured,
        status: 'warn',
        message: 'The bar touched high, near the collarbones.',
      };
    }
    if (along > LOW_ABOVE) {
      return { ...measured, status: 'warn', message: 'The bar touched low, towards the stomach.' };
    }
    return { ...measured, status: 'pass', message: `The bar touched the ${chestPart(along)}.` };
  },
};

/** How far along the body the near-side wrist is, from the shoulder (0) to the hip (1). */
function shareAlongBody(frame: PoseFrame, context: RepContext): number | null {
  const shoulder = sidePoint(frame, context.nearSide, 'Shoulder');
  const hip = sidePoint(frame, context.nearSide, 'Hip');
  const wrist = sidePoint(frame, context.nearSide, 'Wrist');
  if (!shoulder || !hip || !wrist) return null;
  const body = { x: hip.x - shoulder.x, y: hip.y - shoulder.y };
  const lengthSquared = body.x ** 2 + body.y ** 2;
  if (lengthSquared === 0) return null;
  return ((wrist.x - shoulder.x) * body.x + (wrist.y - shoulder.y) * body.y) / lengthSquared;
}

function chestPart(along: number): string {
  if (along < 0.3) return 'upper chest';
  return along < 0.45 ? 'middle of the chest' : 'lower chest';
}
