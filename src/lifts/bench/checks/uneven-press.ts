import type { BodySide, CheckResult, FormCheck, PoseFrame, RepContext } from '../../../core';
import { length, sidePoint, subtract } from '../../../geometry';
import { highestRun, median, repFrames, rollingMedian } from '../../../signal';

/**
 * How uneven the hands may get on the way up, as a share of shoulder width, and still count
 * as even. Shoulder width is the scale because from the head or feet the torso is
 * foreshortened.
 */
const PASS_UP_TO = 0.1;
/** More uneven than this is a fail; between the two is a warning. */
const WARN_UP_TO = 0.2;
/**
 * The start of the rep, at lockout, gives the hands' level to compare against. This also
 * cancels a camera that isn't quite level.
 */
const LEVEL_SECONDS = 0.2;
/**
 * The difference is smoothed with a rolling median over this window, so it has to last over
 * half of it to count, as in the squat's knee check: a single frame is usually jitter.
 */
const SUSTAIN_WINDOW_SECONDS = 0.25;

const ID = 'bench.uneven-press';

/** One arm lagging: one hand trailing the other on the way up, seen from the head or feet. */
export const unevenPress: FormCheck = {
  id: ID,
  label: 'Uneven press',
  supportedViews: ['front', 'back'],
  evaluate(context: RepContext): CheckResult {
    const fps = context.sequence.sampleFps;
    const frames = repFrames(context);
    const levelFrames = Math.max(1, Math.round(LEVEL_SECONDS * fps));
    const level = median(frames.slice(0, levelFrames).map(({ frame }) => rightLowerBy(frame)));
    if (level === null) {
      return skipped("The hands or shoulders weren't seen clearly at the start of this rep.");
    }

    const rising = frames.filter(({ index }) => index >= context.rep.turnFrame);
    const radius = Math.round((SUSTAIN_WINDOW_SECONDS * fps) / 2);
    const differences = rollingMedian(
      rising.map(({ frame }) => {
        const lower = rightLowerBy(frame);
        return lower === null ? null : lower - level;
      }),
      radius,
    );

    // The smoothed difference is often level for a few frames at its largest; the middle one
    // is shown.
    const worst = highestRun(differences.map((d) => (d === null ? null : Math.abs(d))));
    const difference = worst ? (differences[worst.position] ?? null) : null;
    const at = worst ? rising[worst.position] : undefined;
    if (!worst || difference === null || !at) {
      return skipped("The hands weren't seen clearly on the way up.");
    }

    const unevenness = worst.value;
    const measured = { checkId: ID, value: unevenness, frameIndex: at.index };
    if (unevenness <= PASS_UP_TO) {
      return { ...measured, status: 'pass', message: 'Both hands pressed evenly.' };
    }
    const lagging: BodySide = difference > 0 ? 'right' : 'left';
    const onVideo = videoSideOf(at.frame, lagging);
    const hand = onVideo ? `${lagging} hand (on the ${onVideo} of the video)` : `${lagging} hand`;
    return {
      ...measured,
      status: unevenness <= WARN_UP_TO ? 'warn' : 'fail',
      message: `The ${hand} lagged behind on the way up, by about ${String(Math.round(unevenness * 100))}% of your shoulder width.`,
    };
  },
};

/**
 * How much lower the right hand is than the left, as a share of shoulder width. Negative when
 * the left hand is lower. Null if a hand or shoulder wasn't seen.
 */
function rightLowerBy(frame: PoseFrame): number | null {
  const leftWrist = sidePoint(frame, 'left', 'Wrist');
  const rightWrist = sidePoint(frame, 'right', 'Wrist');
  const leftShoulder = sidePoint(frame, 'left', 'Shoulder');
  const rightShoulder = sidePoint(frame, 'right', 'Shoulder');
  if (!leftWrist || !rightWrist || !leftShoulder || !rightShoulder) return null;
  const width = length(subtract(leftShoulder, rightShoulder));
  // y grows downwards, so the lower hand has the larger y.
  return width > 0 ? (rightWrist.y - leftWrist.y) / width : null;
}

/**
 * Which side of the video a hand is on. Saying so as well as naming the hand lets the lifter
 * check it against the video, which matters because which hand is which flips between
 * filming from the feet and from the head, and the model's labels are least sure lying down.
 */
function videoSideOf(frame: PoseFrame, side: BodySide): 'left' | 'right' | null {
  const hand = sidePoint(frame, side, 'Wrist');
  const other = sidePoint(frame, side === 'left' ? 'right' : 'left', 'Wrist');
  if (!hand || !other || hand.x === other.x) return null;
  return hand.x < other.x ? 'left' : 'right';
}

function skipped(message: string): CheckResult {
  return { checkId: ID, status: 'skipped', message };
}
