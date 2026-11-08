import type { LiftPosition } from '../../core';
import { pickMedia } from '../platform/pick-media';

interface PhotoInputsProps {
  positions: readonly LiftPosition[];
  positionId: string;
  onChoosePosition: (positionId: string) => void;
  photo: File | null;
  onChoosePhoto: (photo: File) => void;
}

/** Picture mode on the start screen: which moment of the lift, and the photo of it. */
export function PhotoInputs({
  positions,
  positionId,
  onChoosePosition,
  photo,
  onChoosePhoto,
}: PhotoInputsProps) {
  const chosen = positions.find((position) => position.id === positionId);
  const pick = (source: 'camera' | 'library') => {
    void pickMedia('photo', source).then((picked) => {
      if (picked) onChoosePhoto(picked);
    });
  };

  return (
    <>
      <div className="stack stack--tight">
        <span className="field-label" id="position-label">
          Which moment?
        </span>
        <div
          className="segmented segmented--fit"
          role="radiogroup"
          aria-labelledby="position-label"
        >
          {positions.map((position) => (
            <button
              key={position.id}
              type="button"
              role="radio"
              aria-checked={position.id === positionId}
              className={position.id === positionId ? 'selected' : ''}
              onClick={() => {
                onChoosePosition(position.id);
              }}
            >
              {position.name}
            </button>
          ))}
        </div>
        {chosen && <p className="muted hint">{chosen.description}</p>}
      </div>

      <div className="stack stack--tight">
        <span className="field-label">Photo of that moment</span>
        <div className="file-buttons">
          <button
            type="button"
            className="file-button"
            onClick={() => {
              pick('camera');
            }}
          >
            Take photo
          </button>
          <button
            type="button"
            className="file-button"
            onClick={() => {
              pick('library');
            }}
          >
            Choose photo
          </button>
        </div>
        {photo && (
          <p className="chosen-file">
            <span aria-hidden="true">✓ </span>
            {photo.name}
          </p>
        )}
      </div>

      <details className="tips">
        <summary>Photo tips</summary>
        <ul>
          <li>Get your whole body in the picture, feet included.</li>
          <li>Straight side-on works for every check. Front or back suits the knees.</li>
          <li>Keep the phone level: angles are measured against the edges of the picture.</li>
          <li>
            Use the self-timer or burst mode, or ask someone to take it, so the photo catches the
            exact moment.
          </li>
        </ul>
      </details>
    </>
  );
}
