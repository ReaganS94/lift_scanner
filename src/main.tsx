import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadPhotoImage } from './adapters/photo';
import { MediaPipePoseEstimator } from './adapters/pose';
import { CanvasRegionReader, VideoFrameSource, type FrameImage } from './adapters/video';
import { App } from './ui/App';
import { UpdateNotice } from './ui/components/UpdateNotice';
import type { AnalysisAdapters } from './ui/flow/adapters';
import { letOtherAudioKeepPlaying } from './ui/platform/audio-session';

// One pose model for videos and photos, loaded the first time either needs it.
let poseEstimator: MediaPipePoseEstimator | null = null;

// The one place the browser adapters are built. Everything else receives them.
const adapters: AnalysisAdapters<FrameImage> = {
  openVideo: (url) => VideoFrameSource.open(url),
  openFrameScrubber: (url) => VideoFrameSource.open(url, { primeByPlaying: true }),
  openPhoto: (file) => loadPhotoImage(file),
  createPoseEstimator: () =>
    (poseEstimator ??= new MediaPipePoseEstimator({
      wasmBaseUrl: `${import.meta.env.BASE_URL}mediapipe/wasm`,
    })),
  createRegionReader: () => new CanvasRegionReader(),
};

// Before any video exists, so opening the app doesn't stop music playing in another app.
letOtherAudioKeepPlaying();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

createRoot(root).render(
  <StrictMode>
    <App adapters={adapters} />
    {/* Kept out of App so App can be rendered in tests without a service worker. */}
    <UpdateNotice />
  </StrictMode>,
);
