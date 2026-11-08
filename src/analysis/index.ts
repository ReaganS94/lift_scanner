/**
 * The analysis pipeline, in the order the app runs it:
 *
 * 1. extractPoses: video frames to raw poses (slow; reports progress).
 * 2. prepareClip: pick the lifter out of everyone in shot, clean their poses and guess the
 *    camera view.
 *    The user then confirms or corrects the view.
 * 3. analyzeSet: find the reps and run the lift's checks on each.
 *
 * A photo of one position goes through the same steps as a one-frame clip: photoAsClip, then
 * prepareClip, then analyzePhoto in place of analyzeSet.
 */
export { analyzePhoto, photoAsClip } from './analyze-photo';
export { analyzeSet } from './analyze-set';
export { ExtractionCancelledError, extractPoses } from './extract-poses';
export type { ExtractPosesOptions } from './extract-poses';
export { prepareClip } from './prepare-clip';
export type { PreparedClip } from './prepare-clip';
