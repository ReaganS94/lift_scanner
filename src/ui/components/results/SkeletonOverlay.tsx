import { useEffect, useRef, type RefObject } from 'react';
import type { BodyJoint, PoseSequence } from '../../../core';
import { drawBarPath } from '../../skeleton/draw-bar-path';
import {
  drawSkeleton,
  fitCanvas,
  themeColour,
  type SkeletonStyle,
} from '../../skeleton/draw-skeleton';
import { videoPicture } from '../../skeleton/video-picture';
import type { ZoomView } from '../../zoom/zoom-view';

/** Joints to pick out in a result's colour, while paused on the frame it was measured at. */
export interface SkeletonHighlight {
  readonly joints: ReadonlySet<BodyJoint>;
  readonly status: 'pass' | 'warn' | 'fail';
}

interface SkeletonOverlayProps {
  sequence: PoseSequence;
  videoRef: RefObject<HTMLVideoElement | null>;
  highlight: SkeletonHighlight | null;
  /** How the video is zoomed. The skeleton follows the zoomed picture, redrawn on each change. */
  zoom: ZoomView;
}

/**
 * Draws the tracked skeleton on a canvas laid over the video, following playback. With a
 * highlight, the joints a check looked at, and the lines between them, are drawn thicker in the
 * result's colour. Where the bar was followed, its plate and recent path are drawn too.
 */
export function SkeletonOverlay({ sequence, videoRef, highlight, zoom }: SkeletonOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const highlightRef = useRef(highlight);
  // Colours are read from the theme once per highlight, not on every animation frame.
  const styleRef = useRef<OverlayStyle | null>(null);
  const redrawRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    highlightRef.current = highlight;
    const canvas = canvasRef.current;
    if (canvas) styleRef.current = skeletonStyle(canvas, highlight);
    redrawRef.current();
  }, [highlight]);

  // The picture is measured on every draw, so a redraw is all a zoom needs.
  useEffect(() => {
    redrawRef.current();
  }, [zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    styleRef.current ??= skeletonStyle(canvas, highlightRef.current);
    const drawCurrent = () => {
      const style = styleRef.current ?? skeletonStyle(canvas, highlightRef.current);
      drawFrame(canvas, video, sequence, Math.round(video.currentTime * sequence.sampleFps), style);
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

interface OverlayStyle extends SkeletonStyle {
  /** Colour of the bar's plate and path. */
  readonly barColour: string;
}

/** The skeleton's colours from the theme (styles/theme.css), with the highlight if any. */
function skeletonStyle(
  canvas: HTMLCanvasElement,
  highlight: SkeletonHighlight | null,
): OverlayStyle {
  return {
    colour: themeColour(canvas, 'accent', '#c8f031'),
    barColour: themeColour(canvas, 'bar-path', '#38bdf8'),
    ...(highlight && {
      focus: {
        joints: highlight.joints,
        colour: themeColour(canvas, highlight.status, '#fb4d6d'),
      },
    }),
  };
}

/**
 * Draws one frame over the video's picture. The picture's place and size are measured on every
 * draw rather than taken from the canvas, so a canvas that doesn't exactly cover the picture
 * (as happened on an iPhone, where the skeleton came out too big) still lines up.
 */
function drawFrame(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  sequence: PoseSequence,
  frameIndex: number,
  style: OverlayStyle,
) {
  fitCanvas(canvas);
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);

  const picture = videoPicture(
    canvas.getBoundingClientRect(),
    video.getBoundingClientRect(),
    video.videoWidth,
    video.videoHeight,
  );
  context.save();
  context.translate(picture.x, picture.y);
  const landmarks = sequence.frames[frameIndex]?.landmarks;
  if (landmarks) drawSkeleton(context, landmarks, picture.height, style);
  if (sequence.barTrack) {
    drawBarPath(
      context,
      sequence.barTrack,
      frameIndex,
      sequence.sampleFps,
      picture.height,
      style.barColour,
    );
  }
  context.restore();
}
