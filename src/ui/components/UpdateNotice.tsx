import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Registers the service worker that lets the app be installed and run offline, and says when a
 * new version has been downloaded. It waits for the user to reload rather than reloading by
 * itself, because a reload in the middle of an analysis would lose it.
 */
export function UpdateNotice() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // An app opened from the home screen is often resumed rather than reloaded, and only a
      // reload would look for a new version, so look whenever the app comes back into view.
      // With no signal the look fails; that's fine, the next one will try again.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => undefined);
      });
    },
  });

  if (!needRefresh) return null;
  return (
    <div className="update-notice" role="status">
      <span>A new version is ready. Reload when you’re done with this clip.</span>
      <div className="row">
        <button
          type="button"
          className="primary"
          onClick={() => {
            void updateServiceWorker(true);
          }}
        >
          Reload
        </button>
        <button
          type="button"
          onClick={() => {
            setNeedRefresh(false);
          }}
        >
          Later
        </button>
      </div>
    </div>
  );
}
