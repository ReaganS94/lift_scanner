interface PhotoReadingProps {
  onCancel: () => void;
}

/** Shown while a photo is read and the pose model looks at it: a moment, or longer the first time while the model loads. */
export function PhotoReading({ onCancel }: PhotoReadingProps) {
  return (
    <div className="stack">
      <p>Finding your pose in the photo…</p>
      <progress aria-label="Reading the photo" />
      <p className="muted">The first time, the pose model loads too, which takes a few seconds.</p>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
