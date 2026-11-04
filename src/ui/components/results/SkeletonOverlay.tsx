import { useEffect, useRef, type RefObject } from 'react';
import type { BodyJoint, PoseSequence } from '../../../core';
import { drawSkeleton, fitCanvas, themeColour } from '../../skeleton/draw-skeleton';

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
  fitCanvas(canvas);
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);

  const landmarks = sequence.frames[frameIndex]?.landmarks;
  if (!landmarks) return;

  // Colours come from the theme (styles/theme.css), so the overlay matches the rest of the app.
  drawSkeleton(context, landmarks, canvas.height, {
    colour: themeColour(canvas, 'accent', '#c8f031'),
    ...(highlight && {
      focus: {
        joints: highlight.joints,
        colour: themeColour(canvas, highlight.status, '#fb4d6d'),
      },
    }),
  });
}
