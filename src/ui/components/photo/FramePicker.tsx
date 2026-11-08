import { useCallback, useEffect, useRef, useState } from 'react';
import type { FrameScrubber } from '../../flow/adapters';
import { formatSeconds, stepFrame, timeOfFrame } from '../../playback/frames';
import { videoFrameStyle } from '../../playback/player-layout';
import { canvasToFile } from '../../platform/capture-frame';

interface FramePickerProps {
  video: File;
  /** What to look for, e.g. the position's description. */
  hint: string;
  /** The video being opened; its owner disposes it (see usePickedVideo). */
  opening: Promise<FrameScrubber>;
  onUse: (frame: File) => void;
  onCancel: () => void;
}

/**
 * Frames a second the picker steps by: as fine as most phone videos. A 60 fps clip has a frame
 * between each step, which doesn't matter for picking a position.
 */
const PICKER_FPS = 30;
/** How tall the frame may get, so the buttons stay on screen on a phone. */
const FRAME_MAX_HEIGHT = '50svh';
/** The photo is scaled to this size anyway (see adapters/photo), so no bigger is drawn. */
const MAX_SIDE_PIXELS = 2048;
const UNREADABLE = "This video couldn't be read. Try an MP4 or MOV recorded on your phone.";

/**
 * Scrub a video to one moment, step a frame at a time to get it exactly, and use that frame
 * as the photo.
 *
 * The frame is drawn on a canvas by the same video reader the whole-set analysis uses, rather
 * than shown in a video element: iPhone Safari leaves a video element black until it has
 * played. The canvas is also exactly what gets checked.
 */
export function FramePicker({ video, hint, opening, onUse, onCancel }: FramePickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scrubber, setScrubber] = useState<FrameScrubber | null>(null);
  const [frame, setFrame] = useState(0);
  // The frame the canvas shows; it lags `frame` while a seek runs.
  const [shownFrame, setShownFrame] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Seeks run one at a time; the latest frame asked for is drawn once the current one is done.
  const wanted = useRef(0);
  const drawing = useRef(false);

  useEffect(() => {
    let cancelled = false;
    opening.then(
      (result) => {
        if (!cancelled) setScrubber(result);
      },
      (e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : `${UNREADABLE} (${String(e)})`);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [opening]);

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (drawing.current || !scrubber || !canvas) return;
    drawing.current = true;
    try {
      for (;;) {
        const target = wanted.current;
        await scrubber.drawFrameAt(timeOfFrame(target, PICKER_FPS) * 1000, canvas, MAX_SIDE_PIXELS);
        setShownFrame(target);
        if (wanted.current === target) break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : `${UNREADABLE} (${String(e)})`);
    } finally {
      drawing.current = false;
    }
  }, [scrubber]);

  const frameCount = scrubber
    ? Math.max(1, Math.floor((scrubber.durationMs / 1000) * PICKER_FPS))
    : 1;
  const show = (target: number) => {
    const clamped = stepFrame(target, 0, frameCount);
    wanted.current = clamped;
    setFrame(clamped);
    void draw();
  };

  useEffect(() => {
    if (scrubber) void draw();
  }, [scrubber, draw]);

  const use = () => {
    const canvas = canvasRef.current;
    if (!canvas || shownFrame === null) return;
    const name = `${video.name} at ${formatSeconds(timeOfFrame(shownFrame, PICKER_FPS))}.jpg`;
    canvasToFile(canvas, name).then(onUse, (e: unknown) => {
      setError(e instanceof Error ? e.message : "This frame couldn't be saved.");
    });
  };

  const lastFrame = frameCount - 1;
  return (
    <div className="stack stack--tight">
      <span className="field-label">Pick the frame</span>
      <p className="muted hint">{hint} Step a frame at a time with ‹ and › to get it exact.</p>
      <div className="player">
        <div
          className="video-frame frame-picker__frame"
          style={scrubber ? videoFrameStyle(scrubber.aspectRatio, FRAME_MAX_HEIGHT) : undefined}
        >
          <canvas ref={canvasRef} aria-label="The picked frame" role="img" />
          {!scrubber && !error && <p className="muted frame-picker__loading">Opening the video…</p>}
        </div>
        {scrubber && (
          <div className="playback">
            <div className="playback__scrub">
              <input
                type="range"
                min={0}
                max={lastFrame}
                value={Math.min(frame, lastFrame)}
                aria-label="Position in the video"
                onChange={(event) => {
                  show(Number(event.target.value));
                }}
              />
              <span className="muted playback__time">
                {formatSeconds(timeOfFrame(frame, PICKER_FPS))}
              </span>
            </div>
            <div className="playback__buttons">
              <div className="playback__group">
                <button
                  type="button"
                  aria-label="Back one frame"
                  onClick={() => {
                    show(frame - 1);
                  }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Forward one frame"
                  onClick={() => {
                    show(frame + 1);
                  }}
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="file-buttons">
        <button
          type="button"
          className="file-button"
          disabled={shownFrame === null || shownFrame !== frame}
          onClick={use}
        >
          Use this frame
        </button>
        <button type="button" className="file-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
