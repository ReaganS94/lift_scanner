import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

export type Delegate = 'GPU' | 'CPU';
export type Fileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

/**
 * The "full" pose model: the middle of MediaPipe's lite, full and heavy options, a good
 * balance of accuracy and speed on a phone. Pinned to a version so results don't change
 * underneath us. Downloaded once (about 9 MB), then cached by the browser.
 *
 * On real gym clips the heavy model held the wrists and elbows slightly steadier, but took about
 * three times as long, so it isn't worth it yet.
 */
export const DEFAULT_POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

/** How many people the finder looks for in a frame. */
const MAX_PEOPLE = 3;

/** The two copies of the pose model the estimator runs, on the same device. */
export interface PoseModels {
  readonly delegate: Delegate;
  /**
   * Video mode, one person: follows them from frame to frame, which keeps joints steady and
   * holds on through hard poses, such as knees behind a plate. But it only looks for someone
   * new once it loses them, so on its own it can follow a passer-by for seconds.
   */
  readonly tracker: PoseLandmarker;
  /** Image mode: looks for everyone afresh, so the lifter is found whoever the tracker follows. */
  readonly finder: PoseLandmarker;
  close(): void;
}

export async function createPoseModels(
  fileset: Fileset,
  delegate: Delegate,
  modelUrl: string,
): Promise<PoseModels> {
  const create = (runningMode: 'VIDEO' | 'IMAGE', numPoses: number) =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelUrl, delegate },
      runningMode,
      numPoses,
    });

  const tracker = await create('VIDEO', 1);
  let finder: PoseLandmarker;
  try {
    finder = await create('IMAGE', MAX_PEOPLE);
  } catch (error) {
    tracker.close();
    throw error;
  }
  return {
    delegate,
    tracker,
    finder,
    close() {
      tracker.close();
      finder.close();
    },
  };
}
