import { LANDMARK, type BodyJoint, type Landmark } from '../../core';
import { DEFAULT_MIN_VISIBILITY } from '../../geometry';
import { SKELETON_CONNECTIONS } from './connections';
import { isFocusSegment, jointOf } from './focus';

export interface SkeletonStyle {
  /** Colour of the skeleton's lines. */
  readonly colour: string;
  /** Joints to draw thick and glowing in `focusColour`, with the rest dimmed. */
  readonly focus?: { readonly joints: ReadonlySet<BodyJoint>; readonly colour: string };
}

/**
 * Draws one frame's skeleton: lines between landmarks and a dot on each joint. Landmarks are in
 * frame heights (see Landmark), so both axes are multiplied by `scale`, the drawn frame height.
 */
export function drawSkeleton(
  context: CanvasRenderingContext2D,
  landmarks: readonly Landmark[],
  scale: number,
  style: SkeletonStyle,
): void {
  const { focus } = style;
  const visible = (name: keyof typeof LANDMARK): Landmark | null => {
    const point = landmarks[LANDMARK[name]];
    return point && point.visibility >= DEFAULT_MIN_VISIBILITY ? point : null;
  };
  const line = (a: Landmark, b: Landmark) => {
    context.beginPath();
    context.moveTo(a.x * scale, a.y * scale);
    context.lineTo(b.x * scale, b.y * scale);
    context.stroke();
  };

  context.save();
  context.lineCap = 'round';
  const focusedLines: (readonly [Landmark, Landmark])[] = [];
  context.lineWidth = 3;
  context.strokeStyle = style.colour;
  context.globalAlpha = focus ? 0.45 : 0.9;
  for (const [from, to] of SKELETON_CONNECTIONS) {
    const a = visible(from);
    const b = visible(to);
    if (!a || !b) continue;
    if (focus && isFocusSegment(from, to, focus.joints)) focusedLines.push([a, b]);
    else line(a, b);
  }
  context.globalAlpha = 1;

  // The focused lines go on top, thick and glowing.
  if (focus) {
    context.lineWidth = 6;
    context.strokeStyle = focus.colour;
    context.shadowColor = focus.colour;
    context.shadowBlur = 12;
    for (const [a, b] of focusedLines) line(a, b);
    context.shadowBlur = 0;
  }

  // A ring for the head, centred on the nose.
  const nose = visible('nose');
  if (nose) {
    context.lineWidth = 3;
    context.strokeStyle = style.colour;
    context.globalAlpha = focus ? 0.45 : 0.9;
    context.beginPath();
    context.arc(nose.x * scale, nose.y * scale, 0.035 * scale, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 1;
  }

  // A dot on every joint, bigger and coloured on the focused ones.
  for (const name of Object.keys(LANDMARK) as (keyof typeof LANDMARK)[]) {
    const joint = jointOf(name);
    const point = joint && visible(name);
    if (!joint || !point) continue;
    const focused = focus?.joints.has(joint) ?? false;
    context.beginPath();
    context.arc(point.x * scale, point.y * scale, focused ? 6 : 3.5, 0, Math.PI * 2);
    context.fillStyle = focused && focus ? focus.colour : '#ffffff';
    context.fill();
    if (focused) {
      context.lineWidth = 2;
      context.strokeStyle = '#ffffff';
      context.stroke();
    }
  }
  context.restore();
}

/** A theme colour from the CSS custom properties in effect on an element. */
export function themeColour(element: Element, name: string, fallback: string): string {
  return getComputedStyle(element).getPropertyValue(`--${name}`).trim() || fallback;
}

/** Matches a canvas's drawing buffer to its displayed size. */
export function fitCanvas(canvas: HTMLCanvasElement): void {
  const { clientWidth, clientHeight } = canvas;
  if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
    canvas.width = clientWidth;
    canvas.height = clientHeight;
  }
}
