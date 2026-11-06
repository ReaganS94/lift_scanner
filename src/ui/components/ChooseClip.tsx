import { useState, type SubmitEvent } from 'react';
import { liftRegistry } from '../../lifts';
import { pickVideo } from '../platform/pick-video';
import { loadLastLift, saveLastLift } from '../preferences/last-lift';
import { APP_COMMIT, APP_VERSION } from '../version';

interface ChooseClipProps {
  onStart: (liftId: string, file: File) => void;
  /** Opens the live framing check, to set the phone up before filming. */
  onCheckFraming: () => void;
}

/** First screen: pick the lift, then record the set or choose a video of it. */
export function ChooseClip({ onStart, onCheckFraming }: ChooseClipProps) {
  const lifts = liftRegistry.all();
  const [liftId, setLiftId] = useState(() => {
    const last = loadLastLift();
    return last && lifts.some((lift) => lift.id === last) ? last : (lifts[0]?.id ?? '');
  });
  const [file, setFile] = useState<File | null>(null);
  const chosenLift = lifts.find((lift) => lift.id === liftId);
  const liftTips = chosenLift?.filmingTips ?? [];

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !liftId) return;
    saveLastLift(liftId);
    onStart(liftId, file);
  };

  const pick = (source: 'camera' | 'library') => {
    void pickVideo(source).then((picked) => {
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

      <div className="stack stack--tight">
        <span className="field-label">Video of your set</span>
        <div className="file-buttons">
          {/* Record set opens the camera on a phone, a file picker elsewhere. See pickVideo for
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
        <button type="button" className="link framing-link" onClick={onCheckFraming}>
          Check framing before you film
        </button>
        <p className="muted hint">
          Videos recorded here may not be saved to your photos. To keep one, film with the camera
          app and use Choose video.
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
          <li>
            Film from straight side-on, or straight from the front or back. Side views up to about
            45° off are corrected for, but straight side-on gives the best results.
          </li>
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

      <button type="submit" className="primary" disabled={!file}>
        Analyse set
      </button>
      <p className="muted">The video is processed on this device and never uploaded.</p>
      <p className="muted version">
        {APP_VERSION}
        {APP_COMMIT && <span className="version__commit"> · {APP_COMMIT}</span>}
      </p>
    </form>
  );
}
