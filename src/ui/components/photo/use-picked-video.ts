import { useCallback, useEffect, useRef, useState } from 'react';
import type { FrameScrubber } from '../../flow/adapters';

/** A video picked for the frame picker, already being opened. */
export interface PickedVideo {
  readonly file: File;
  readonly opening: Promise<FrameScrubber>;
}

interface Held extends PickedVideo {
  release(): void;
}

/**
 * Holds the video the frame picker shows. It starts opening the moment it's picked, as the
 * whole-set analysis does: an iPhone never loaded a video opened a render later, from the
 * picker itself ("opening timed out"). Releasing it, or unmounting, disposes it.
 */
export function usePickedVideo(openFrameScrubber: (url: string) => Promise<FrameScrubber>) {
  const [video, setVideo] = useState<Held | null>(null);
  const held = useRef<Held | null>(null);

  const replace = useCallback((next: Held | null) => {
    held.current?.release();
    held.current = next;
    setVideo(next);
  }, []);

  const open = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      const opening = openFrameScrubber(url);
      replace({
        file,
        opening,
        release: () => {
          opening.then(
            (scrubber) => {
              scrubber.dispose();
              URL.revokeObjectURL(url);
            },
            () => {
              URL.revokeObjectURL(url);
            },
          );
        },
      });
    },
    [openFrameScrubber, replace],
  );
  const close = useCallback(() => {
    replace(null);
  }, [replace]);

  useEffect(
    () => () => {
      held.current?.release();
      held.current = null;
    },
    [],
  );

  return { video: video as PickedVideo | null, open, close };
}
