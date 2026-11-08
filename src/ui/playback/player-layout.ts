/**
 * Below this width-to-height ratio a video is tall enough that, capped in height to leave
 * room for the results, it leaves a wide empty band beside it on a phone. The controls then
 * go in that band instead of in rows under the video.
 */
const SIDE_CONTROLS_BELOW_ASPECT_RATIO = 0.9;

/** The player's class: controls beside a portrait video, under anything wider. */
export function playerClassName(aspectRatio: number): string {
  return aspectRatio < SIDE_CONTROLS_BELOW_ASPECT_RATIO ? 'player player--side' : 'player';
}

/** The video's box: its own shape, as wide as fits without getting taller than `maxHeight`. */
export function videoFrameStyle(
  aspectRatio: number,
  maxHeight: string,
): { aspectRatio: string; width: string } {
  return {
    aspectRatio: String(aspectRatio),
    width: `min(100%, calc(${maxHeight} * ${String(aspectRatio)}))`,
  };
}
