import { useState, type SubmitEvent } from 'react';
import { liftRegistry } from '../../lifts';

interface ChooseClipProps {
  onStart: (liftId: string, file: File) => void;
}

/** First screen: pick the lift and the video of the set. */
export function ChooseClip({ onStart }: ChooseClipProps) {
  const lifts = liftRegistry.all();
  const [liftId, setLiftId] = useState(lifts[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (file && liftId) onStart(liftId, file);
  };

  return (
    <form className="stack" onSubmit={submit}>
      <fieldset className="choice-group">
        <legend>Which lift?</legend>
        {lifts.map((lift) => (
          <label key={lift.id} className="choice">
            <input
              type="radio"
              name="lift"
              value={lift.id}
              checked={liftId === lift.id}
              onChange={() => {
                setLiftId(lift.id);
              }}
            />
            {lift.name}
          </label>
        ))}
      </fieldset>

      <label className="file-picker">
        <span>Video of your set</span>
        <input
          type="file"
          accept="video/*"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
          }}
        />
      </label>

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
    </form>
  );
}
