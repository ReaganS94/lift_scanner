import { ExtractionCancelledError } from '../../analysis';

/**
 * Waits for a promise, but rejects with ExtractionCancelledError as soon as the signal aborts,
 * so Cancel works even while a slow step (loading the video, downloading the model) is under
 * way. The underlying work isn't stopped; its result is just no longer waited for.
 */
export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new ExtractionCancelledError());
      return;
    }
    const onAbort = () => {
      reject(new ExtractionCancelledError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
