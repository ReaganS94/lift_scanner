/** A point or offset on screen, in CSS pixels. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The size of the box the zoomed content fills, in CSS pixels. */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * How the video is zoomed: scaled by `scale` from its top-left corner, then moved by `x` and `y`.
 * Matches `transform: translate(x, y) scale(scale)` with `transform-origin: 0 0`.
 */
export interface ZoomView {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

export const NO_ZOOM: ZoomView = { scale: 1, x: 0, y: 0 };

/** Close enough to the whole picture to be the whole picture. */
const SNAP_TO_NO_ZOOM_BELOW = 1.05;
export const MIN_SCALE = 1;
export const MAX_SCALE = 5;

export function isZoomed(view: ZoomView): boolean {
  return view.scale > MIN_SCALE;
}

/**
 * Keeps the scale between 1 and 5 and the picture covering the whole box, so zooming can never
 * show empty space past the video's edges.
 */
export function clampView(view: ZoomView, size: Size): ZoomView {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale));
  return {
    scale,
    x: clamp(view.x, size.width - size.width * scale, 0),
    y: clamp(view.y, size.height - size.height * scale, 0),
  };
}

/** Moves a zoomed picture by a finger's drag. */
export function panBy(view: ZoomView, delta: Point, size: Size): ZoomView {
  return clampView({ ...view, x: view.x + delta.x, y: view.y + delta.y }, size);
}

/** Zooms to a new scale keeping the spot under `point` (relative to the box) where it is. */
export function zoomAround(view: ZoomView, scale: number, point: Point, size: Size): ZoomView {
  return pinchView(view, point, 1, point, scale / view.scale, size);
}

/**
 * Where a pinch has got to. The spot that was under the fingers' midpoint when the pinch began
 * follows the midpoint, and the scale grows with the distance between the fingers, so pinching
 * zooms and moving both fingers pans at the same time.
 */
export function pinchView(
  start: ZoomView,
  startMidpoint: Point,
  startDistance: number,
  midpoint: Point,
  distance: number,
  size: Size,
): ZoomView {
  if (startDistance <= 0) return start;
  const scale = clamp((start.scale * distance) / startDistance, MIN_SCALE, MAX_SCALE);
  // The spot under the starting midpoint, in the unzoomed picture's pixels.
  const spotX = (startMidpoint.x - start.x) / start.scale;
  const spotY = (startMidpoint.y - start.y) / start.scale;
  return clampView({ scale, x: midpoint.x - spotX * scale, y: midpoint.y - spotY * scale }, size);
}

/** At the end of a gesture, a barely zoomed picture goes back to the whole picture. */
export function settleView(view: ZoomView): ZoomView {
  return view.scale < SNAP_TO_NO_ZOOM_BELOW ? NO_ZOOM : view;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
