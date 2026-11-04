import { useEffect, useRef, type RefObject } from 'react';
import { LANDMARK, type BodyJoint, type Landmark, type PoseSequence } from '../../../core';
import { DEFAULT_MIN_VISIBILITY } from '../../../geometry';
import { SKELETON_CONNECTIONS } from '../../skeleton/connections';
import { isFocusSegment, jointOf } from '../../skeleton/focus';

/** Joints to pick out in a result's colour, while paused on the frame it was measured at. */
export interface SkeletonHighlight {
  readonly joints: ReadonlySet<BodyJoint>;
  readonly status: 'pass' | 'warn' | 'fail';
}

interface SkeletonOverlayProps {
  sequence: PoseSequence;
  videoRef: RefObject<HTMLVideoElement | null>;
  highlight: SkeletonHighlight | null;
}

/**
 * Draws the tracked skeleton on a canvas laid over the video, following playback. With a
 * highlight, the joints a check looked at, and the lines between them, are drawn thicker in the
 * result's colour.
 */
export function SkeletonOverlay({ sequence, videoRef, highlight }: SkeletonOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const highlightRef = useRef(highlight);
  const redrawRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    highlightRef.current = highlight;
    redrawRef.current();
  }, [highlight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const drawCurrent = () => {
      drawFrame(
        canvas,
        sequence,
        Math.round(video.currentTime * sequence.sampleFps),
        highlightRef.current,
      );
    };
    redrawRef.current = drawCurrent;

    // Redraw every animation frame while playing; once per seek or pause otherwise.
    let animationFrame = 0;
    const loop = () => {
      drawCurrent();
      animationFrame = requestAnimationFrame(loop);
    };
    const onPlay = () => {
      cancelAnimationFrame(animationFrame);
      loop();
    };
    const onStop = () => {
      cancelAnimationFrame(animationFrame);
      drawCurrent();
    };

    const stopEvents = ['pause', 'ended', 'seeked', 'loadeddata'] as const;
    video.addEventListener('play', onPlay);
    for (const event of stopEvents) video.addEventListener(event, onStop);
    window.addEventListener('resize', drawCurrent);
    if (video.paused) drawCurrent();
    else onPlay();

    return () => {
      cancelAnimationFrame(animationFrame);
      redrawRef.current = () => undefined;
      video.removeEventListener('play', onPlay);
      for (const event of stopEvents) video.removeEventListener(event, onStop);
      window.removeEventListener('resize', drawCurrent);
    };
  }, [sequence, videoRef]);

  return <canvas ref={canvasRef} className="skeleton-overlay" aria-hidden="true" />;
}

function drawFrame(
  canvas: HTMLCanvasElement,
  sequence: PoseSequence,
  frameIndex: number,
  highlight: SkeletonHighlight | null,
) {
  const { clientWidth, clientHeight } = canvas;
  if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
    canvas.width = clientWidth;
    canvas.height = clientHeight;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);

  const landmarks = sequence.frames[frameIndex]?.landmarks;
  if (!landmarks) return;

  // Colours come from the theme (styles/theme.css), so the overlay matches the rest of the app.
  const style = getComputedStyle(canvas);
  const base = style.getPropertyValue('--accent').trim() || '#c8f031';
  const focusColour = highlight
    ? style.getPropertyValue(`--${highlight.status}`).trim() || '#fb4d6d'
    : base;

  // Landmarks are in frame heights (see Landmark), so both axes scale by the drawn height.
  const scale = canvas.height;
  const visible = (name: keyof typeof LANDMARK): Landmark | null => {
    const point = landmarks[LANDMARK[name]];
    return point && point.visibility >= DEFAULT_MIN_VISIBILITY ? point : null;
  };

  context.lineCap = 'round';
  const focusedLines: (readonly [Landmark, Landmark])[] = [];
  context.lineWidth = 3;
  context.strokeStyle = base;
  context.globalAlpha = highlight ? 0.45 : 0.9;
  for (const [from, to] of SKELETON_CONNECTIONS) {
    const a = visible(from);
    const b = visible(to);
    if (!a || !b) continue;
    if (highlight && isFocusSegment(from, to, highlight.joints)) {
      focusedLines.push([a, b]);
      continue;
    }
    context.beginPath();
    context.moveTo(a.x * scale, a.y * scale);
    context.lineTo(b.x * scale, b.y * scale);
    context.stroke();
  }
  context.globalAlpha = 1;

  // The focused lines go on top, thick and glowing.
  context.lineWidth = 6;
  context.strokeStyle = focusColour;
  context.shadowColor = focusColour;
  context.shadowBlur = 12;
  for (const [a, b] of focusedLines) {
    context.beginPath();
    context.moveTo(a.x * scale, a.y * scale);
    context.lineTo(b.x * scale, b.y * scale);
    context.stroke();
  }
  context.shadowBlur = 0;

  // A dot on every joint, bigger and coloured on the focused ones.
  for (const name of Object.keys(LANDMARK) as (keyof typeof LANDMARK)[]) {
    const joint = jointOf(name);
    const point = joint && visible(name);
    if (!joint || !point) continue;
    const focused = highlight?.joints.has(joint) ?? false;
    context.beginPath();
    context.arc(point.x * scale, point.y * scale, focused ? 6 : 3.5, 0, Math.PI * 2);
    context.fillStyle = focused ? focusColour : '#ffffff';
    context.fill();
    if (focused) {
      context.lineWidth = 2;
      context.strokeStyle = '#ffffff';
      context.stroke();
    }
  }
}
