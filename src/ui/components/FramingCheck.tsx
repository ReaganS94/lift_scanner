import { useEffect, useRef, useState } from 'react';
import type { View } from '../../core';
import type { AnalysisAdapters } from '../flow/adapters';
import { useFramingCheck } from '../flow/use-framing-check';
import { drawSkeleton, fitCanvas, themeColour } from '../skeleton/draw-skeleton';

interface FramingCheckProps<TImage> {
  adapters: AnalysisAdapters<TImage>;
  onClose: () => void;
}

/** The two ways of filming the app judges: side-on, or square to the front or back. */
const VIEW_OPTIONS: readonly { view: View; label: string }[] = [
  { view: 'side', label: 'Side' },
  { view: 'front', label: 'Front or back' },
];

/**
 * A live camera preview that says how to set the phone up before filming a set: how far the
 * camera is turned from the wanted view, and whether the whole body is in the picture and big
 * enough. The camera turns off when this screen closes.
 */
export function FramingCheck<TImage>({ adapters, onClose }: FramingCheckProps<TImage>) {
  const [wanted, setWanted] = useState<View>('side');
  const { state, camera, livePose } = useFramingCheck(adapters, wanted);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Shows the camera's own video element inside the frame.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !camera) return;
    return camera.show(frame, 'framing__video');
  }, [camera]);

  // Draws the latest skeleton over the picture, and keeps the frame the picture's shape.
  useEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;
    const colour = themeColour(canvas, 'accent', '#c8f031');
    let animationFrame = 0;
    let lastTimeMs: number | null = null;
    const draw = () => {
      animationFrame = requestAnimationFrame(draw);
      const live = livePose.current;
      if (!live || live.pose.timeMs === lastTimeMs) return;
      lastTimeMs = live.pose.timeMs;
      frame.style.aspectRatio = String(live.aspectRatio);
      fitCanvas(canvas);
      const context = canvas.getContext('2d');
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (live.pose.landmarks) {
        drawSkeleton(context, live.pose.landmarks, canvas.height, { colour });
      }
    };
    draw();
    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [livePose]);

  return (
    <div className="stack framing">
      <h2>Check framing</h2>
      <fieldset className="lift-options framing__views">
        <legend>Filming from</legend>
        {VIEW_OPTIONS.map(({ view, label }) => (
          <label key={view} className="lift-option">
            <input
              type="radio"
              name="framing-view"
              value={view}
              checked={wanted === view}
              onChange={() => {
                setWanted(view);
              }}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      <div ref={frameRef} className="framing__frame">
        <canvas ref={canvasRef} aria-hidden="true" />
      </div>

      <div className="framing__advice" role="status" aria-live="polite">
        <Advice state={state} />
      </div>

      <p className="muted hint">
        The camera stays on while this is open, which pauses music on iPhones. Close it before you
        record.
      </p>
      <button type="button" className="primary" onClick={onClose}>
        Done
      </button>
    </div>
  );
}

function Advice({ state }: { state: ReturnType<typeof useFramingCheck>['state'] }) {
  if (state.step === 'starting') return <p className="muted">Opening the camera…</p>;
  if (state.step === 'error') return <p role="alert">{state.message}</p>;
  const { advice } = state;
  if (!advice) return <p className="muted">Looking for you…</p>;
  if (advice.status === 'good') {
    return (
      <p className="framing__good">
        <span aria-hidden="true">✓ </span>Looks good. Keep the phone just like this.
      </p>
    );
  }
  return (
    <ul className="framing__tips">
      {advice.tips.map((tip) => (
        <li key={tip}>{tip}</li>
      ))}
    </ul>
  );
}
