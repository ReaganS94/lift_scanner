import { useEffect, useRef } from 'react';
import type { LivePoseBox } from '../flow/live-pose';
import { drawSkeleton, fitCanvas, themeColour } from '../skeleton/draw-skeleton';

interface LiveSkeletonProps {
  livePose: LivePoseBox;
}

/** Portrait until the first pose says otherwise, since most clips are filmed on a phone. */
const DEFAULT_ASPECT_RATIO = 9 / 16;
const MAX_HEIGHT = 'min(45svh, 24rem)';

/** Sizes the box to the video's shape, as tall as allowed but never wider than the screen. */
function frameSize(aspectRatio: number) {
  return {
    aspectRatio: String(aspectRatio),
    width: `min(100%, calc(${MAX_HEIGHT} * ${String(aspectRatio)}))`,
  };
}

/**
 * The skeleton found in the frame being tracked, redrawn every animation frame. Shows tracking
 * working while you wait, and makes a bad camera angle obvious early.
 */
export function LiveSkeleton({ livePose }: LiveSkeletonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;

    let animationFrame = 0;
    let lastTimeMs: number | null = null;
    const draw = () => {
      animationFrame = requestAnimationFrame(draw);
      const live = livePose.current;
      if (!live || live.pose.timeMs === lastTimeMs) return;
      lastTimeMs = live.pose.timeMs;

      Object.assign(frame.style, frameSize(live.aspectRatio));
      frame.dataset.found = String(live.pose.landmarks !== null);
      fitCanvas(canvas);
      const context = canvas.getContext('2d');
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (live.pose.landmarks) {
        drawSkeleton(context, live.pose.landmarks, canvas.height, {
          colour: themeColour(canvas, 'accent', '#c8f031'),
        });
      }
    };
    draw();
    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [livePose]);

  return (
    <div
      ref={frameRef}
      className="live-skeleton"
      style={frameSize(DEFAULT_ASPECT_RATIO)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} />
      <span className="live-skeleton__lost">Looking for you…</span>
    </div>
  );
}
