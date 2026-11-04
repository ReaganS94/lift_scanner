import { useState, type ChangeEvent, type SubmitEvent } from 'react';
import { liftRegistry } from '../../lifts';
import { loadLastLift, saveLastLift } from '../preferences/last-lift';
import { APP_VERSION } from '../version';

interface ChooseClipProps {
  onStart: (liftId: string, file: File) => void;
}

/** First screen: pick the lift, then record the set or choose a video of it. */
export function ChooseClip({ onStart }: ChooseClipProps) {
  const lifts = liftRegistry.all();
  const [liftId, setLiftId] = useState(() => {
    const last = loadLastLift();
    return last && lifts.some((lift) => lift.id === last) ? last : (lifts[0]?.id ?? '');
  });
  const [file, setFile] = useState<File | null>(null);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !liftId) return;
    saveLastLift(liftId);
    onStart(liftId, file);
  };

  const pickFile = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
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
          {/* On a phone, `capture` opens the camera straight away; elsewhere it's a file picker. */}
          <label className="file-button">
            <input type="file" accept="video/*" capture="environment" onChange={pickFile} />
            Record set
          </label>
          <label className="file-button">
            <input type="file" accept="video/*" onChange={pickFile} />
            Choose video
          </label>
        </div>
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
          <li>Film from straight side-on, or straight from the front or back. Avoid 45°.</li>
          <li>Prop the phone at about hip height, a few metres away, and keep it still.</li>
          <li>
            Keep the phone level. Depth and torso angle are measured against the edges of the
            picture, so a phone tilted 5° shifts them by 5°.
          </li>
          <li>Start recording before your first rep and stop after your last.</li>
        </ul>
      </details>

      <button type="submit" className="primary" disabled={!file}>
        Analyse set
      </button>
      <p className="muted">The video is processed on this device and never uploaded.</p>
      <p className="muted version">Version {APP_VERSION}</p>
    </form>
  );
}
