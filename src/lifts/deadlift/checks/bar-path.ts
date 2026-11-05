import type { CheckResult, FormCheck, RepContext } from '../../../core';
import { rollingMedian } from '../../../signal';
import { pullOf } from '../pull';

/**
 * How far forward the hands may move from where they left the floor, in torso lengths, and
 * still count as close to the legs. A torso length is roughly 50 cm, so 0.1 is about 5 cm.
 * The bar moving back towards the body as the knees straighten is normal and not counted.
 */
const PASS_UP_TO_TORSOS = 0.1;
/** Drifting further than this is a fail; between the two is a warning. */
const WARN_UP_TO_TORSOS = 0.2;
/**
 * The bar's position is steadied with a median over this many frames either side, so one frame
 * where the plate or hands were placed wrongly can't fail a rep.
 */
const STEADY_RADIUS_FRAMES = 2;

const ID = 'deadlift.bar-path';

/**
 * The bar drifting away from the legs during the pull, followed through the near plate where it
 * was found, otherwise the hands.
 */
export const barPath: FormCheck = {
  id: ID,
  label: 'Bar path',
  supportedViews: ['side'],
  focus: ['elbow', 'wrist'],
  evaluate(context: RepContext): CheckResult {
    const pull = pullOf(context);
    if (!pull || pull.tracker === 'shoulders') {
      return {
        checkId: ID,
        status: 'skipped',
        message:
          'Neither the plate nor the hands were followed clearly. Film from straight side-on with the whole plate in view.',
      };
    }

    const xs = rollingMedian(
      pull.barPoints.map((point) => point?.x ?? null),
      STEADY_RADIUS_FRAMES,
    );
    const start = xs[pull.liftoff];
    const liftoff = pull.frames[pull.liftoff];
    if (start === null || start === undefined || !liftoff) {
      return {
        checkId: ID,
        status: 'skipped',
        message: "The bar wasn't seen as it left the floor.",
      };
    }

    let furthest = { drift: 0, frameIndex: liftoff.index };
    pull.frames.forEach(({ index }, at) => {
      const x = xs[at];
      if (at < pull.liftoff || x === null || x === undefined) return;
      const drift = ((x - start) * pull.facing) / context.torsoLength;
      if (drift > furthest.drift) furthest = { drift, frameIndex: index };
    });

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
