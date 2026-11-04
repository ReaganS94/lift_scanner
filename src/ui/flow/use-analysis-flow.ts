import { useCallback, useEffect, useReducer, useRef } from 'react';
import { analyzeSet, ExtractionCancelledError, extractPoses, prepareClip } from '../../analysis';
import type { View } from '../../core';
import { liftRegistry } from '../../lifts';
import { MediaPipePoseEstimator } from '../../adapters/pose';
import { VideoFrameSource } from '../../adapters/video';
import { flowReducer, INITIAL_FLOW } from './analysis-flow';

/** Frames analysed per second of video. Enough to catch every phase of a rep. */
const SAMPLE_FPS = 30;

/** Runs the analysis pipeline for the screens, wiring in the browser adapters. */
export function useAnalysisFlow() {
  const [state, dispatch] = useReducer(flowReducer, INITIAL_FLOW);
  const cancelled = useRef(false);
  // Kept between clips so the pose model only loads once.
  const estimator = useRef<MediaPipePoseEstimator | null>(null);
  // The object URL for the current clip, used for analysis and playback. Released when the
  // user moves on to another clip.
  const videoUrl = useRef<string | null>(null);

  const releaseVideo = useCallback(() => {
    if (videoUrl.current) URL.revokeObjectURL(videoUrl.current);
    videoUrl.current = null;
  }, []);

  useEffect(() => releaseVideo, [releaseVideo]);

  const start = useCallback(
    async (liftId: string, file: File) => {
      releaseVideo();
      const url = URL.createObjectURL(file);
      videoUrl.current = url;
      cancelled.current = false;
      dispatch({ type: 'start', liftId, videoUrl: url });

      let source: VideoFrameSource | null = null;
      try {
        source = await VideoFrameSource.open(url);
        estimator.current ??= new MediaPipePoseEstimator({
          wasmBaseUrl: `${import.meta.env.BASE_URL}mediapipe/wasm`,
        });
        await estimator.current.init();

        const raw = await extractPoses(source, estimator.current, {
          sampleFps: SAMPLE_FPS,
          onProgress: (progress) => {
            dispatch({ type: 'progress', progress });
          },
          isCancelled: () => cancelled.current,
        });
        dispatch({ type: 'extracted', raw, prepared: prepareClip(raw) });
      } catch (error) {
        if (error instanceof ExtractionCancelledError) {
          releaseVideo();
          dispatch({ type: 'reset' });
        } else {
          dispatch({ type: 'failed', message: messageOf(error) });
        }
      } finally {
        source?.dispose();
      }
    },
    [releaseVideo],
  );

  const cancel = useCallback(() => {
    cancelled.current = true;
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
    releaseVideo();
    dispatch({ type: 'reset' });
  }, [releaseVideo]);

  return { state, start, cancel, confirmView, changeView, reset };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong while reading the video.';
}
