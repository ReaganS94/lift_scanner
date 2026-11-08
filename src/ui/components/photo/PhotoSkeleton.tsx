import { useEffect, useRef, type RefObject } from 'react';
import type { Landmark } from '../../../core';
import { drawSkeleton, fitCanvas, themeColour } from '../../skeleton/draw-skeleton';
import { videoPicture } from '../../skeleton/video-picture';
import type { SkeletonHighlight } from '../results/SkeletonOverlay';

interface PhotoSkeletonProps {
  landmarks: readonly Landmark[] | null;
  imageRef: RefObject<HTMLImageElement | null>;
  highlight: SkeletonHighlight | null;
}

/**
 * Draws the pose found in a photo on a canvas laid over it. With a highlight, the joints a
 * check looked at are drawn thicker in the result's colour. Redrawn when the photo loads, the
 * window resizes or the highlight changes.
 */
export function PhotoSkeleton({ landmarks, imageRef, highlight }: PhotoSkeletonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    const colour = themeColour(canvas, 'accent', '#c8f031');
    const style = {
      colour,
      ...(highlight && {
        focus: {
          joints: highlight.joints,
          colour: themeColour(canvas, highlight.status, '#fb4d6d'),
        },
      }),
    };
    const draw = () => {
      fitCanvas(canvas);
      const context = canvas.getContext('2d');
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (!landmarks) return;
      // As for videos, the picture's place is measured on every draw so the skeleton lines up
      // even if the canvas and the image differ a little in size.
      const picture = videoPicture(
        canvas.getBoundingClientRect(),
        image.getBoundingClientRect(),
        image.naturalWidth,
        image.naturalHeight,
      );
      context.save();
      context.translate(picture.x, picture.y);
      drawSkeleton(context, landmarks, picture.height, style);
      context.restore();
    };

    draw();
    image.addEventListener('load', draw);
    window.addEventListener('resize', draw);
    return () => {
      image.removeEventListener('load', draw);
      window.removeEventListener('resize', draw);
    };
  }, [landmarks, imageRef, highlight]);

  return <canvas ref={canvasRef} className="skeleton-overlay" aria-hidden="true" />;
}
