import type { CheckResult, FormCheck, PoseFrame, RepContext } from '../../../core';
import { jointAngle, sidePoint } from '../../../geometry';
import { lowestRun, rollingMedian } from '../../../signal';

/**
 * Bend left at the elbow at the top, in degrees, that still counts as locked out. Some
 * allowance is needed: the model's shoulder, elbow and wrist points don't line up perfectly
 * even with the arm straight.
 */
const PASS_UP_TO_DEGREES = 15;
/** More bend than this is a fail; between the two is a warning. */
const WARN_UP_TO_DEGREES = 25;
/**
 * The rep ends when the hands are back near lockout height, which can be just before the
 * arms finish straightening, so lockout is looked for from a little before the rep's end to a
 * little after it.
 */
const BEFORE_END_SECONDS = 0.25;
const AFTER_END_SECONDS = 0.5;
/**
 * The bend is smoothed with a rolling median over this window, three frames at the app's 30
 * frames a second, before taking the smallest. So one frame where jitter happens to line the
 * points up can't pass a soft lockout. It is kept short because between touch-and-go reps
 * the arms may be straight for only a moment; a 0.25 s window, as the knee check uses, warned
 * on most of those.
 */
const SUSTAIN_WINDOW_SECONDS = 0.08;

const ID = 'bench.lockout';

/** Full lockout: the near-side elbow straight at the top of the press. */
export const lockout: FormCheck = {
  id: ID,
  label: 'Lockout',
  supportedViews: ['side'],
  focus: ['shoulder', 'elbow', 'wrist'],
  evaluate(context: RepContext): CheckResult {
    const { rep, sequence } = context;
    const fps = sequence.sampleFps;
    const from = Math.max(rep.turnFrame, rep.endFrame - Math.round(BEFORE_END_SECONDS * fps));
    const to = Math.min(
      sequence.frames.length - 1,
      rep.endFrame + Math.round(AFTER_END_SECONDS * fps),
    );
    const indices = Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
    const bends = indices.map((index) => {
      const frame = sequence.frames[index];
      return frame ? elbowBend(frame, context) : null;
    });

    const radius = Math.round((SUSTAIN_WINDOW_SECONDS * fps) / 2);
    const straightest = lowestRun(rollingMedian(bends, radius));
    const frameIndex = straightest ? indices[straightest.position] : undefined;
    if (!straightest || frameIndex === undefined) {
      return {
        checkId: ID,
        status: 'skipped',
        message: "The shoulder, elbow or wrist wasn't seen clearly at the top.",
      };
    }

    const degrees = Math.round(straightest.value);
    const measured = { checkId: ID, value: straightest.value, frameIndex };
    if (degrees <= PASS_UP_TO_DEGREES) {
      return { ...measured, status: 'pass', message: 'Elbows locked out at the top.' };
    }
    return {
      ...measured,
      status: degrees <= WARN_UP_TO_DEGREES ? 'warn' : 'fail',
      message: `Elbows stayed ${String(degrees)}° bent at the top.`,
    };
  },
};

/** How far the near-side elbow is from straight, in degrees, or null if a point is unseen. */
function elbowBend(frame: PoseFrame, context: RepContext): number | null {
  const shoulder = sidePoint(frame, context.nearSide, 'Shoulder');
  const elbow = sidePoint(frame, context.nearSide, 'Elbow');
  const wrist = sidePoint(frame, context.nearSide, 'Wrist');
  const angle = shoulder && elbow && wrist ? jointAngle(shoulder, elbow, wrist) : null;
  return angle === null ? null : 180 - angle;
}
