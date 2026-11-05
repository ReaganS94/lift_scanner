import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  analyzeSet,
  ExtractionCancelledError,
  extractPoses,
  prepareClip,
  type ExtractPosesOptions,
} from '../../analysis';
import { createPlateTracker } from '../../bar';
import type { PoseEstimator, View } from '../../core';
import { liftRegistry } from '../../lifts';
import { abortable } from './abortable';
import type { AnalysisAdapters, DisposableFrameSource } from './adapters';
import { flowReducer, INITIAL_FLOW } from './analysis-flow';
import type { LivePoseBox } from './live-pose';

/** Frames analysed per second of video. Enough to catch every phase of a rep. */
const SAMPLE_FPS = 30;

/** Runs the analysis pipeline for the screens, using the adapters passed in. */
export function useAnalysisFlow<TImage>(adapters: AnalysisAdapters<TImage>) {
  const [state, dispatch] = useReducer(flowReducer, INITIAL_FLOW);
  // One controller per run: Cancel aborts it, and starting a new run aborts the old one.
  const run = useRef<AbortController | null>(null);
  // Kept between clips so the pose model only loads once.
  const estimator = useRef<PoseEstimator<TImage> | null>(null);
  // The object URL for the current clip, used for analysis and playback. Released when the
  // user moves on to another clip.
  const videoUrl = useRef<string | null>(null);
  // The latest pose while tracking, for the processing screen to draw.
  const livePose = useRef<LivePoseBox['current']>(null);

  const releaseVideo = useCallback(() => {
    if (videoUrl.current) URL.revokeObjectURL(videoUrl.current);
    videoUrl.current = null;
  }, []);

  useEffect(
    () => () => {
      run.current?.abort();
      releaseVideo();
    },
    [releaseVideo],
  );

  const start = useCallback(
    async (liftId: string, file: File) => {
      run.current?.abort();
      const controller = new AbortController();
      run.current = controller;
      const { signal } = controller;
      // Only the latest run may change the screen.
      const isCurrent = () => run.current === controller;

      releaseVideo();
      const url = URL.createObjectURL(file);
      videoUrl.current = url;
      livePose.current = null;
      dispatch({ type: 'start', liftId, videoUrl: url });

      const opening = adapters.openVideo(url);
      let source: DisposableFrameSource<TImage> | null = null;
      try {
        source = await abortable(opening, signal);
        estimator.current ??= adapters.createPoseEstimator();
        await abortable(estimator.current.init(), signal);
        const trackBar = barTrackerFor(liftId, source.aspectRatio, adapters);

        const raw = await extractPoses(source, estimator.current, {
          sampleFps: SAMPLE_FPS,
          onProgress: (progress) => {
            if (isCurrent()) dispatch({ type: 'progress', progress });
          },
          onFrame: (pose, aspectRatio) => {
            if (isCurrent()) livePose.current = { pose, aspectRatio };
          },
          isCancelled: () => signal.aborted,
          ...(trackBar ? { trackBar } : {}),
        });
        if (isCurrent()) dispatch({ type: 'extracted', raw, prepared: prepareClip(raw) });
      } catch (error) {
        if (!isCurrent()) return;
        if (error instanceof ExtractionCancelledError) {
          releaseVideo();
          dispatch({ type: 'reset' });
        } else {
          dispatch({ type: 'failed', message: messageOf(error) });
        }
      } finally {
        if (source) source.dispose();
        // If cancelled while the video was still opening, release it once it has opened.
        else
          void opening.then(
            (late) => {
              late.dispose();
            },
            () => undefined,
          );
      }
    },
    [adapters, releaseVideo],
  );

  const cancel = useCallback(() => {
    run.current?.abort();
  }, []);

  const confirmView = useCallback(
    (view: View) => {
      if (state.step !== 'confirm-view') return;
      const lift = liftRegistry.get(state.liftId);
      const { prepared } = state;
      if (!lift || prepared.torsoLength === null) return;

      const report = analyzeSet(
        {
          sequence: prepared.sequence,
          view,
          torsoLength: prepared.torsoLength,
          nearSide: prepared.nearSide,
          ...(prepared.viewGuess.angleFromSide === null
            ? {}
            : { angleFromSide: prepared.viewGuess.angleFromSide }),
        },
        lift,
      );
      dispatch({ type: 'analysed', report });
    },
    [state],
  );

  const changeView = useCallback(() => {
    dispatch({ type: 'change-view' });
  }, []);

  const reset = useCallback(() => {
    run.current?.abort();
    run.current = null;
    releaseVideo();
    dispatch({ type: 'reset' });
  }, [releaseVideo]);

  return { state, livePose, start, cancel, confirmView, changeView, reset };
}

/** A bar tracker for this clip, if the lift follows the bar. */
function barTrackerFor<TImage>(
  liftId: string,
  aspectRatio: number,
  adapters: AnalysisAdapters<TImage>,
): ExtractPosesOptions<TImage>['trackBar'] {
  if (!liftRegistry.get(liftId)?.followsBar) return undefined;
  const tracker = createPlateTracker(aspectRatio);
  const reader = adapters.createRegionReader();
  return (frame, pose) =>
    tracker.track(pose, (region, pixelsPerUnit) => reader.read(frame.image, region, pixelsPerUnit));
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong while reading the video.';
}
