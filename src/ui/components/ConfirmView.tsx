import { useState } from 'react';
import type { PreparedClip } from '../../analysis';
import { VIEWS, type View } from '../../core';
import { viewLabel } from '../flow/analysis-flow';

interface ConfirmViewProps {
  prepared: PreparedClip;
  onConfirm: (view: View) => void;
  onStartOver: () => void;
}

/** The app's guess at the camera view, for the user to confirm or correct before analysis. */
export function ConfirmView({ prepared, onConfirm, onStartOver }: ConfirmViewProps) {
  const { viewGuess, torsoLength } = prepared;
  const [view, setView] = useState<View | null>(viewGuess.view);

  if (torsoLength === null) {
    return (
      <div className="stack">
        <p>
          No lifter was found clearly enough in this video. Make sure your whole body is in frame
          and well lit.
        </p>
        <button type="button" className="primary" onClick={onStartOver}>
          Try another video
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      <h2>Which way was the camera facing you?</h2>
      <p>
        {viewGuess.view ? (
          <>
            Looks like a <strong>{viewLabel(viewGuess.view).toLowerCase()} view</strong>
            {viewGuess.confidence === 'low' ? ', but I’m not sure' : ''}.{' '}
          </>
        ) : null}
        <span className="muted">{viewGuess.reason}</span>
      </p>

      <div className="segmented" role="radiogroup" aria-label="Camera view">
        {VIEWS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={view === option}
            className={view === option ? 'selected' : ''}
            onClick={() => {
              setView(option);
            }}
          >
            {viewLabel(option)}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="primary"
        disabled={view === null}
        onClick={() => {
          if (view) onConfirm(view);
        }}
      >
        Confirm and analyse
      </button>
    </div>
  );
}
