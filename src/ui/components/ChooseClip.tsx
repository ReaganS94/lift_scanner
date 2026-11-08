import { useState, type SubmitEvent } from 'react';
import { liftRegistry } from '../../lifts';
import { pickMedia } from '../platform/pick-media';
import type { FrameScrubber } from '../flow/adapters';
import { PhotoInputs } from './PhotoInputs';
import { loadLastLift, saveLastLift } from '../preferences/last-lift';
import { APP_COMMIT, APP_VERSION } from '../version';

interface ChooseClipProps {
  onStart: (liftId: string, file: File) => void;
  /** Picture mode: check one moment of the lift from a photo. */
  onStartPhoto: (liftId: string, positionId: string, photo: File) => void;
  /** Opens a video for picking one frame of it as the photo. */
  openFrameScrubber: (url: string) => Promise<FrameScrubber>;
}

type Mode = 'video' | 'photo';

/**
 * First screen: pick the lift, then record the set or choose a video of it. In picture mode,
 * pick a moment of the lift and a photo of it instead.
 */
export function ChooseClip({ onStart, onStartPhoto, openFrameScrubber }: ChooseClipProps) {
  const lifts = liftRegistry.all();
  const [liftId, setLiftId] = useState(() => {
    const last = loadLastLift();
    return last && lifts.some((lift) => lift.id === last) ? last : (lifts[0]?.id ?? '');
  });
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>('video');
  const [photo, setPhoto] = useState<File | null>(null);
  // The moment picked for each lift, so switching lifts and back keeps it.
  const [positionIds, setPositionIds] = useState<Readonly<Record<string, string>>>({});
  const chosenLift = lifts.find((lift) => lift.id === liftId);
  const liftTips = chosenLift?.filmingTips ?? [];
  const positions = chosenLift?.positions ?? [];
  const positionId = positionIds[liftId] ?? positions[0]?.id ?? '';
  const photoMode = mode === 'photo' && positions.length > 0;
  const ready = photoMode ? photo !== null && positionId !== '' : file !== null;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!liftId) return;
    if (photoMode) {
      if (!photo || !positionId) return;
      saveLastLift(liftId);
      onStartPhoto(liftId, positionId, photo);
      return;
    }
    if (!file) return;
    saveLastLift(liftId);
    onStart(liftId, file);
  };

  const pick = (source: 'camera' | 'library') => {
    void pickMedia('video', source).then((picked) => {
      if (picked) setFile(picked);
    });
  };

  return (
    <form className="stack" onSubmit={submit}>
      <fieldset className="lift-options">
        <legend>Which lift?</legend>
        {lifts.map((lift) => (
          <label key={lift.id} className="lift-option">
            <input
              type="radio"
              name="lift"
              value={lift.id}
              checked={liftId === lift.id}
              onChange={() => {
                setLiftId(lift.id);
              }}
            />
            <span>{lift.name}</span>
          </label>
        ))}
      </fieldset>

      <div className="segmented segmented--two" role="radiogroup" aria-label="What to check">
        {(['video', 'photo'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={mode === option}
            className={mode === option ? 'selected' : ''}
            disabled={option === 'photo' && positions.length === 0}
            onClick={() => {
              setMode(option);
            }}
          >
            {option === 'video' ? 'All reps' : 'One position'}
          </button>
        ))}
      </div>

      {photoMode ? (
        <PhotoInputs
          openFrameScrubber={openFrameScrubber}
          positions={positions}
          positionId={positionId}
          onChoosePosition={(id) => {
            setPositionIds((ids) => ({ ...ids, [liftId]: id }));
          }}
          photo={photo}
          onChoosePhoto={setPhoto}
        />
      ) : (
        <>
          <div className="stack stack--tight">
            <span className="field-label">Video of your set</span>
            <div className="file-buttons">
              {/* Record set opens the camera on a phone, a file picker elsewhere. See pickMedia for
                why neither keeps a file input in the page. */}
              <button
                type="button"
                className="file-button"
                onClick={() => {
                  pick('camera');
                }}
              >
                Record set
              </button>
              <button
                type="button"
                className="file-button"
                onClick={() => {
                  pick('library');
                }}
              >
                Choose video
              </button>
            </div>
            <p className="muted hint">
              Videos recorded here may not be saved to your photos. To keep one, film with the
              camera app and use Choose video.
            </p>
            {file && (
              <p className="chosen-file">
                <span aria-hidden="true">✓ </span>
                {file.name}
              </p>
            )}
          </div>

          <details className="tips">
            <summary>Filming tips</summary>
            <ul>
              <li>Keep your whole body in frame for the whole set.</li>
              <li>Film from straight side-on, or straight from the front or back. Avoid 45°.</li>
              <li>Prop the phone at about hip height, a few metres away, and keep it still.</li>
              <li>
                Keep the phone level. Depth and torso angle are measured against the edges of the
                picture, so a phone tilted 5° shifts them by 5°.
              </li>
              <li>Start recording before your first rep and stop after your last.</li>
            </ul>
            {chosenLift && liftTips.length > 0 && (
              <>
                <p className="tips-heading">{chosenLift.name}</p>
                <ul>
                  {liftTips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </>
            )}
          </details>
        </>
      )}

      <button type="submit" className="primary" disabled={!ready}>
        {photoMode ? 'Check position' : 'Analyse set'}
      </button>
      <p className="muted">
        The {photoMode ? 'photo' : 'video'} is processed on this device and never uploaded.
      </p>
      <p className="muted version">
        {APP_VERSION}
        {APP_COMMIT && <span className="version__commit"> · {APP_COMMIT}</span>}
      </p>
    </form>
  );
}
