import type { CheckResult, FormCheck, RepContext } from '../../../core';
import { averagePoint, WRISTS } from '../../../geometry';
import { pullOf } from '../pull';

/**
 * How far forward the hands may move from where they left the floor, in torso lengths, and
 * still count as close to the legs. A torso length is roughly 50 cm, so 0.1 is about 5 cm.
 * The bar moving back towards the body as the knees straighten is normal and not counted.
 */
const PASS_UP_TO_TORSOS = 0.1;
/** Drifting further than this is a fail; between the two is a warning. */
const WARN_UP_TO_TORSOS = 0.2;

const ID = 'deadlift.bar-path';

/** The bar drifting away from the legs during the pull, followed through the hands. */
export const barPath: FormCheck = {
  id: ID,
  label: 'Bar path',
  supportedViews: ['side'],
  evaluate(context: RepContext): CheckResult {
    const pull = pullOf(context);
    const liftoff = pull?.frames[pull.liftoff];
    const start = liftoff && averagePoint(liftoff.frame, WRISTS);
    if (!pull || !start) {
      return {
        checkId: ID,
        status: 'skipped',
        message: "The hands weren't seen clearly at the floor.",
      };
    }

    let furthest = { drift: 0, frameIndex: liftoff.index };
    for (const { frame, index } of pull.frames.slice(pull.liftoff)) {
      const hands = averagePoint(frame, WRISTS);
      if (!hands) continue;
      const drift = ((hands.x - start.x) * pull.facing) / context.torsoLength;
      if (drift > furthest.drift) furthest = { drift, frameIndex: index };
    }

    const percent = Math.round(furthest.drift * 100);
    const measured = { checkId: ID, value: furthest.drift, frameIndex: furthest.frameIndex };
    if (furthest.drift <= PASS_UP_TO_TORSOS) {
      return { ...measured, status: 'pass', message: 'The bar stayed close to the legs.' };
    }
    return {
      ...measured,
      status: furthest.drift <= WARN_UP_TO_TORSOS ? 'warn' : 'fail',
      message: `The bar drifted forward during the pull, by about ${String(percent)}% of your torso length.`,
    };
  },
};
