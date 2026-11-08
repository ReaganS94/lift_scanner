import { formatSeconds, timeOfFrame } from '../../playback/frames';
import { PLAYBACK_RATES, type Playback } from '../../playback/use-playback';

interface PlaybackControlsProps {
  playback: Playback;
  sampleFps: number;
  frameCount: number;
  /** The rep that "Loop" repeats, shown as its number. Null when no rep is selected. */
  loopRepNumber: number | null;
  looping: boolean;
  onToggleLoop: () => void;
  /** Whether the skeleton (and bar path) is drawn over the video. */
  showSkeleton: boolean;
  onToggleSkeleton: () => void;
}

/**
 * Controls for studying a rep: scrub, play, step a frame at a time, slow motion, loop, and
 * hiding the skeleton to see the lift itself.
 */
export function PlaybackControls({
  playback,
  sampleFps,
  frameCount,
  loopRepNumber,
  looping,
  onToggleLoop,
  showSkeleton,
  onToggleSkeleton,
}: PlaybackControlsProps) {
  const lastFrame = Math.max(frameCount - 1, 0);
  return (
    <div className="playback">
      <div className="playback__scrub">
        <input
          type="range"
          min={0}
          max={lastFrame}
          value={Math.min(playback.frame, lastFrame)}
          aria-label="Position in the video"
          onChange={(event) => {
            playback.showFrame(Number(event.target.value));
          }}
        />
        <span className="muted playback__time">
          {formatSeconds(timeOfFrame(playback.frame, sampleFps))}
        </span>
      </div>

      <div className="playback__buttons">
        <div className="playback__group">
          <button
            type="button"
            aria-label="Back one frame"
            onClick={() => {
              playback.step(-1);
            }}
          >
            ‹
          </button>
          <button
            type="button"
            className="playback__play"
            aria-label={playback.playing ? 'Pause' : 'Play'}
            onClick={playback.togglePlay}
          >
            {playback.playing ? '❚❚' : '▶'}
          </button>
          <button
            type="button"
            aria-label="Forward one frame"
            onClick={() => {
              playback.step(1);
            }}
          >
            ›
          </button>
        </div>

        <div className="playback__group" role="radiogroup" aria-label="Playback speed">
          {PLAYBACK_RATES.map((rate) => (
            <button
              key={rate}
              type="button"
              role="radio"
              aria-checked={playback.rate === rate}
              className={playback.rate === rate ? 'selected' : ''}
              onClick={() => {
                playback.setRate(rate);
              }}
            >
              {rate === 1 ? '1×' : `${String(rate).replace(/^0/, '')}×`}
            </button>
          ))}
        </div>

        <div className="playback__group">
          <button
            type="button"
            aria-pressed={looping}
            className={looping ? 'selected' : ''}
            disabled={loopRepNumber === null}
            aria-label={loopRepNumber === null ? 'Loop' : `Loop rep ${String(loopRepNumber)}`}
            onClick={onToggleLoop}
          >
            ⟲ Loop
          </button>
          <button
            type="button"
            aria-pressed={showSkeleton}
            className={showSkeleton ? 'selected' : ''}
            aria-label="Show skeleton"
            onClick={onToggleSkeleton}
          >
            Skeleton
          </button>
        </div>
      </div>
    </div>
  );
}
