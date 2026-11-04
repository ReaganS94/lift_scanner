import { describe, expect, it } from 'vitest';
import { ExtractionCancelledError } from '../../analysis';
import { abortable } from './abortable';

describe('abortable', () => {
  it('passes the result through when not cancelled', async () => {
    await expect(abortable(Promise.resolve(3), new AbortController().signal)).resolves.toBe(3);
  });

  it('rejects as soon as the signal aborts, without waiting for the work', async () => {
    const controller = new AbortController();
    const never = new Promise<never>(() => undefined);
    const waiting = abortable(never, controller.signal);
    controller.abort();
    await expect(waiting).rejects.toBeInstanceOf(ExtractionCancelledError);
  });

  it('rejects straight away if already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(abortable(Promise.resolve(1), controller.signal)).rejects.toBeInstanceOf(
      ExtractionCancelledError,
    );
  });
});
