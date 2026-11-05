import type { BarPoint } from '../../core';

/** How much of the bar's path to draw behind it, in seconds: about one rep. */
const TRAIL_SECONDS = 3;

/**
 * Draws where the bar tracker found the plate in this frame, as a ring round the plate, and the
 * path its centre took over the last few seconds. Gaps where it wasn't found are left as gaps,
 * so the drawing never shows more than was found. Positions are in frame heights (see Landmark),
 * multiplied by `scale`, the drawn frame height.
 */
export function drawBarPath(
  context: CanvasRenderingContext2D,
  track: readonly (BarPoint | null)[],
  frameIndex: number,
  sampleFps: number,
  scale: number,
  colour: string,
): void {
  const first = Math.max(0, frameIndex - Math.round(TRAIL_SECONDS * sampleFps));
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = colour;

  context.lineWidth = 3;
  context.globalAlpha = 0.85;
  context.beginPath();
  let drawing = false;
  for (let index = first; index <= frameIndex && index < track.length; index++) {
    const point = track[index];
    if (!point) {
      drawing = false;
      continue;
    }
    if (drawing) context.lineTo(point.x * scale, point.y * scale);
    else context.moveTo(point.x * scale, point.y * scale);
    drawing = true;
  }
  context.stroke();

  const current = track[frameIndex];
  if (current) {
    context.globalAlpha = 1;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(current.x * scale, current.y * scale, current.radius * scale, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(current.x * scale, current.y * scale, 4, 0, Math.PI * 2);
    context.fillStyle = colour;
    context.fill();
  }
  context.restore();
}
