import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { frameAtTime, stepFrame, timeOfFrame, type FrameRange } from './frames';

/** The slow-motion speeds offered, plus normal speed. */
export const PLAYBACK_RATES = [0.25, 0.5, 1] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export interface Playback {
  /** The sample frame the video is showing. */
  readonly frame: number;
  readonly playing: boolean;
  readonly rate: PlaybackRate;
  readonly setRate: (rate: PlaybackRate) => void;
  readonly togglePlay: () => void;
  /** Pauses and moves by whole sample frames, so each step shows a new skeleton. */
  readonly step: (delta: number) => void;
  /** Pauses on a frame. */
  readonly showFrame: (frame: number) => void;
  /** Plays from the start of a range. */
  readonly playFrom: (range: FrameRange) => void;
}

interface PlaybackOptions {
  readonly sampleFps: number;
  readonly frameCount: number;
  /** While set, playback jumps back to its start whenever it passes its end. */
  readonly loop: FrameRange | null;
}

/**
 * Drives the results video: play and pause, slow motion, frame steps and looping one rep.
 * Reads the frame every animation frame while playing, so the chart's playhead and the loop
 * follow the video smoothly.
 */
export function usePlayback(
  videoRef: RefObject<HTMLVideoElement | null>,
  { sampleFps, frameCount, loop }: PlaybackOptions,
): Playback {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState<PlaybackRate>(1);
  const loopRef = useRef(loop);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let animationFrame = 0;
    const read = () => {
      const range = loopRef.current;
      if (range && !video.paused && video.currentTime > timeOfFrame(range.endFrame, sampleFps)) {
        video.currentTime = timeOfFrame(range.startFrame, sampleFps);
      }
      setFrame(frameAtTime(video.currentTime, sampleFps));
    };
    const loopWhilePlaying = () => {
      read();
      animationFrame = requestAnimationFrame(loopWhilePlaying);
    };
    const onPlay = () => {
      setPlaying(true);
      cancelAnimationFrame(animationFrame);
      loopWhilePlaying();
    };
    const onPause = () => {
      setPlaying(false);
      cancelAnimationFrame(animationFrame);
      read();
    };
    // A rep that runs to the very end of the clip stops the video instead of passing its end.
    const onEnded = () => {
      const range = loopRef.current;
      if (!range) return;
      video.currentTime = timeOfFrame(range.startFrame, sampleFps);
      void video.play();
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', read);
    video.addEventListener('ended', onEnded);
    return () => {
      cancelAnimationFrame(animationFrame);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', read);
      video.removeEventListener('ended', onEnded);
    };
  }, [videoRef, sampleFps]);

  const showFrame = useCallback(
    (target: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.pause();
      video.currentTime = timeOfFrame(stepFrame(target, 0, frameCount), sampleFps);
    },
    [videoRef, sampleFps, frameCount],
  );

  const step = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video) return;
      showFrame(stepFrame(frameAtTime(video.currentTime, sampleFps), delta, frameCount));
    },
    [videoRef, sampleFps, frameCount, showFrame],
  );

  const playFrom = useCallback(
    (range: FrameRange) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = timeOfFrame(range.startFrame, sampleFps);
      void video.play();
    },
    [videoRef, sampleFps],
  );

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }, [videoRef]);

  const setRate = useCallback(
    (next: PlaybackRate) => {
      const video = videoRef.current;
      if (video) video.playbackRate = next;
      setRateState(next);
    },
    [videoRef],
  );

  return { frame, playing, rate, setRate, togglePlay, step, showFrame, playFrom };
}
