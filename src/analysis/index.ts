/**
 * The analysis pipeline, in the order the app runs it:
 *
 * 1. extractPoses: video frames to raw poses (slow; reports progress).
 * 2. prepareClip: clean the poses and guess the camera view.
 *    The user then confirms or corrects the view.
 * 3. analyzeSet: find the reps and run the lift's checks on each.
 */
export { analyzeSet } from './analyze-set';
export { ExtractionCancelledError, extractPoses } from './extract-poses';
export type { ExtractPosesOptions } from './extract-poses';
export { prepareClip } from './prepare-clip';
export type { PreparedClip } from './prepare-clip';
