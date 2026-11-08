import { useCallback, useEffect, useReducer, useRef } from 'react';
import { analyzePhoto, ExtractionCancelledError, photoAsClip, prepareClip } from '../../analysis';
import type { View } from '../../core';
import { abortable } from './abortable';
import type { AnalysisAdapters, OpenedPhoto } from './adapters';
import { IDLE_PHOTO_FLOW, photoFlowReducer, positionOf } from './photo-flow';

/** Runs picture mode for the screens: reads a photo, finds the pose and checks the position. */
export function usePhotoFlow<TImage>(adapters: AnalysisAdapters<TImage>) {
  const [state, dispatch] = useReducer(photoFlowReducer, IDLE_PHOTO_FLOW);
  // One controller per photo: Cancel aborts it, and a new photo aborts the old one.
  const run = useRef<AbortController | null>(null);
  // The photo on screen, released when the user moves on.
  const photo = useRef<OpenedPhoto<TImage> | null>(null);

  const releasePhoto = useCallback(() => {
    photo.current?.dispose();
    photo.current = null;
  }, []);

  useEffect(
    () => () => {
      run.current?.abort();
      releasePhoto();
    },
    [releasePhoto],
  );

  const start = useCallback(
    async (liftId: string, positionId: string, file: File) => {
      run.current?.abort();
      const controller = new AbortController();
      run.current = controller;
      const { signal } = controller;
      const isCurrent = () => run.current === controller;

      releasePhoto();
      dispatch({ type: 'start', liftId, positionId });
      const opening = adapters.openPhoto(file);
      let opened: OpenedPhoto<TImage> | null = null;
      try {
        opened = await abortable(opening, signal);
        photo.current = opened;
        const estimator = adapters.createPoseEstimator();
        await abortable(estimator.init(), signal);
        const pose = await abortable(
          estimator.estimateStill(opened.image, opened.aspectRatio),
          signal,
        );
        const raw = photoAsClip(pose, opened.aspectRatio);
        if (!isCurrent()) return;
        dispatch({
          type: 'read',
          photo: { url: opened.url, aspectRatio: opened.aspectRatio },
          raw,
          prepared: prepareClip(raw),
        });
      } catch (error) {
        // Cancelled while the photo was still being read: release it once it's read.
        if (opened === null) {
          void opening.then(
            (late) => {
              late.dispose();
            },
            () => undefined,
          );
        }
        if (!isCurrent()) return;
        releasePhoto();
        if (error instanceof ExtractionCancelledError) dispatch({ type: 'reset' });
        else dispatch({ type: 'failed', message: messageOf(error) });
      }
    },
    [adapters, releasePhoto],
  );

  const confirmView = useCallback(
    (view: View) => {
      if (state.step !== 'confirm-view') return;
      const position = positionOf(state.liftId, state.positionId);
      const { prepared } = state;
      if (!position || prepared.torsoLength === null) return;
      const report = analyzePhoto(
        {
          sequence: prepared.sequence,
          view,
          torsoLength: prepared.torsoLength,
          nearSide: prepared.nearSide,
          ...(prepared.viewGuess.angleFromSide === null
            ? {}
            : { angleFromSide: prepared.viewGuess.angleFromSide }),
        },
        position,
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
    releasePhoto();
    dispatch({ type: 'reset' });
  }, [releasePhoto]);

  return { state, start, confirmView, changeView, reset };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong while reading the photo.';
}
