import { useEffect } from 'react';

/**
 * Keeps the screen on while `active` is true, so a phone doesn't lock and stall a long job.
 * The browser drops the lock whenever the page is hidden, so it's asked for again on return.
 * Does nothing where the Screen Wake Lock API isn't available.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let released = false;
    const request = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (released) await next.release();
        else lock = next;
      } catch {
        // Refused, e.g. by battery saver. The job still runs; the screen may just lock.
      }
    };
    const onVisibilityChange = () => {
      void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void lock?.release();
    };
  }, [active]);
}
