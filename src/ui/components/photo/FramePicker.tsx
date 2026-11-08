import { useEffect, useRef, useState } from 'react';
import { formatSeconds, timeOfFrame } from '../../playback/frames';
import { usePlayback } from '../../playback/use-playback';
import { captureFrame } from '../../platform/capture-frame';
import { PlaybackControls } from '../results/PlaybackControls';

interface FramePickerProps {
  video: File;
  /** What to look for, e.g. the position's description. */
  hint: string;
  onUse: (frame: File) => void;
  onCancel: () => void;
}

/** Frames a second the picker steps by: as fine as most phone videos. */
const PICKER_FPS = 30;
/** How tall the video may get, so the buttons stay on screen on a phone. */
const VIDEO_MAX_HEIGHT = '50svh';

/**
 * Scrub a video to one moment, step a frame at a time to get it exactly, and use that frame
 * as the photo.
 */
export function FramePicker({ video, hint, onUse, onCancel }: FramePickerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url] = useState(() => URL.createObjectURL(video));
  const [shape, setShape] = useState<{ aspectRatio: number; frameCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playback = usePlayback(videoRef, {
    sampleFps: PICKER_FPS,
    frameCount: shape?.frameCount ?? 1,
    loop: null,
  });

  useEffect(
    () => () => {
      URL.revokeObjectURL(url);
    },
    [url],
  );

  const use = () => {
    const element = videoRef.current;
    if (!element) return;
    element.pause();
    const seconds = timeOfFrame(playback.frame, PICKER_FPS);
    captureFrame(element, `${video.name} at ${formatSeconds(seconds)}.jpg`).then(
      onUse,
      (e: unknown) => {
        setError(e instanceof Error ? e.message : "This frame couldn't be read from the video.");
      },
    );
  };

  return (
    <div className="stack stack--tight">
      <span className="field-label">Pick the frame</span>
      <p className="muted hint">{hint} Step a frame at a time with ‹ and › to get it exact.</p>
      <div className="player">
        <div
          className="video-frame"
          style={
            shape
              ? {
                  aspectRatio: String(shape.aspectRatio),
                  width: `min(100%, calc(${VIDEO_MAX_HEIGHT} * ${String(shape.aspectRatio)}))`,
                }
              : undefined
          }
        >
          <video
            ref={videoRef}
            src={url}
            playsInline
            muted
            preload="auto"
            onClick={playback.togglePlay}
            onLoadedMetadata={(event) => {
              const { videoWidth, videoHeight, duration } = event.currentTarget;
              setShape({
                aspectRatio: videoHeight > 0 ? videoWidth / videoHeight : 1,
                frameCount: Number.isFinite(duration)
                  ? Math.max(1, Math.floor(duration * PICKER_FPS))
                  : 1,
              });
            }}
            onError={() => {
              setError("This video couldn't be read. Try an MP4 or MOV recorded on your phone.");
            }}
          />
        </div>
        {shape && (
          <PlaybackControls
            playback={playback}
            sampleFps={PICKER_FPS}
            frameCount={shape.frameCount}
          />
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="file-buttons">
        <button type="button" className="file-button" disabled={!shape} onClick={use}>
          Use this frame
        </button>
        <button type="button" className="file-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
