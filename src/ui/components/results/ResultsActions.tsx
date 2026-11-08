import { useRef } from 'react';

interface ResultsActionsProps {
  /** The main button's text. */
  startOverLabel?: string;
  onStartOver: () => void;
  onDownloadPoses: () => void;
}

/**
 * The results screen's actions, in a bar along the bottom of the screen. Less common actions
 * sit in a "More" menu.
 */
export function ResultsActions({
  startOverLabel = 'Analyse another set',
  onStartOver,
  onDownloadPoses,
}: ResultsActionsProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  return (
    <div className="action-bar">
      <button type="button" className="primary" onClick={onStartOver}>
        {startOverLabel}
      </button>
      <details ref={menuRef} className="menu">
        <summary aria-label="More actions">⋯</summary>
        <div className="menu__items">
          <button
            type="button"
            onClick={() => {
              if (menuRef.current) menuRef.current.open = false;
              onDownloadPoses();
            }}
          >
            Download pose data
          </button>
        </div>
      </details>
    </div>
  );
}
