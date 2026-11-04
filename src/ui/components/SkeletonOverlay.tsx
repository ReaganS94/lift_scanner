import { useEffect, useRef, type RefObject } from 'react';
import { LANDMARK, type PoseSequence } from '../../core';
import { DEFAULT_MIN_VISIBILITY } from '../../geometry';
import { SKELETON_CONNECTIONS } from '../skeleton/connections';

interface SkeletonOverlayProps {
  sequence: PoseSequence;
  videoRef: RefObject<HTMLVideoElement | null>;
}

/** Draws the tracked skeleton on a canvas laid over the video, following playback. */
export function SkeletonOverlay({ sequence, videoRef }: SkeletonOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const drawCurrent = () => {
      drawFrame(canvas, sequence, Math.round(video.currentTime * sequence.sampleFps));
    };

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
      video.removeEventListener('play', onPlay);
      for (const event of stopEvents) video.removeEventListener(event, onStop);
      window.removeEventListener('resize', drawCurrent);
    };
  }, [sequence, videoRef]);

  return <canvas ref={canvasRef} className="skeleton-overlay" aria-hidden="true" />;
}

function drawFrame(canvas: HTMLCanvasElement, sequence: PoseSequence, frameIndex: number) {
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

  // Landmarks are in frame heights (see Landmark), so both axes scale by the drawn height.
  const scale = canvas.height;
  const visible = (name: keyof typeof LANDMARK) => {
    const point = landmarks[LANDMARK[name]];
    return point && point.visibility >= DEFAULT_MIN_VISIBILITY ? point : null;
  };

  context.lineWidth = 3;
  context.strokeStyle = 'rgba(56, 189, 248, 0.9)';
  for (const [from, to] of SKELETON_CONNECTIONS) {
    const a = visible(from);
    const b = visible(to);
    if (!a || !b) continue;
    context.beginPath();
    context.moveTo(a.x * scale, a.y * scale);
    context.lineTo(b.x * scale, b.y * scale);
    context.stroke();
  }
}
