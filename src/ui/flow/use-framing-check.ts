import { useEffect, useRef, useState } from 'react';
import type { PoseFrame, View } from '../../core';
import { checkFraming, type FramingAdvice } from '../../view';
import type { AnalysisAdapters, LiveCamera } from './adapters';
import type { LivePoseBox } from './live-pose';

/** Advice is judged on this much of the most recent preview, so one odd frame doesn't flip it. */
const WINDOW_MS = 1000;
/** How often the advice on screen is refreshed. Faster would make the text flicker. */
const ADVICE_EVERY_MS = 500;

export type FramingCheckState =
  | { readonly step: 'starting' }
  | { readonly step: 'running'; readonly advice: FramingAdvice | null }
  | { readonly step: 'error'; readonly message: string };

/**
 * Runs the live framing check while the calling screen is shown: opens the camera, finds the
 * pose in each picture as fast as the phone allows, and judges the last second of poses with
 * checkFraming. The camera and the model are released when the screen goes away.
 */
export function useFramingCheck<TImage>(adapters: AnalysisAdapters<TImage>, wanted: View) {
  const [state, setState] = useState<FramingCheckState>({ step: 'starting' });
  const [camera, setCamera] = useState<LiveCamera<TImage> | null>(null);
  const livePose = useRef<LivePoseBox['current']>(null);
  const wantedRef = useRef(wanted);
  useEffect(() => {
    wantedRef.current = wanted;
  }, [wanted]);

  useEffect(() => {
    const controller = new AbortController();
    // A function, so TypeScript doesn't narrow the flag to false inside the async loop.
    const stopped = () => controller.signal.aborted;
    let opened: LiveCamera<TImage> | null = null;
    const estimator = adapters.createPoseEstimator();

    const run = async () => {
      opened = await adapters.openCamera();
      // Closed while the camera was opening: the cleanup below has already run.
      if (stopped()) {
        opened.stop();
        return;
      }
      setCamera(opened);
      await estimator.init();
      if (stopped()) return;
      setState({ step: 'running', advice: null });

      const startMs = performance.now();
      const recent: PoseFrame[] = [];
      let lastAdviceMs = -Infinity;
      while (!stopped()) {
        const aspectRatio = opened.aspectRatio;
        const pose = await estimator.estimate(
          { timeMs: performance.now() - startMs, image: opened.image },
          aspectRatio,
        );
        if (stopped()) return;
        livePose.current = { pose, aspectRatio };
        recent.push(pose);
        while (recent.length > 0 && (recent[0]?.timeMs ?? 0) < pose.timeMs - WINDOW_MS) {
          recent.shift();
        }
        if (pose.timeMs - lastAdviceMs >= ADVICE_EVERY_MS) {
          lastAdviceMs = pose.timeMs;
          const sampleFps = (recent.length * 1000) / WINDOW_MS;
          const advice = checkFraming(
            { sampleFps, aspectRatio, frames: recent },
            wantedRef.current,
          );
          setState({ step: 'running', advice });
        }
        // Let the page draw between poses.
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    };

    run().catch((error: unknown) => {
      if (stopped()) return;
      const message =
        error instanceof Error ? error.message : 'Something went wrong with the camera.';
      setState({ step: 'error', message });
    });

    return () => {
      controller.abort();
      opened?.stop();
      estimator.dispose();
      livePose.current = null;
    };
  }, [adapters, livePose]);

  return { state, camera, livePose };
}
