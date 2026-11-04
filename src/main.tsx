import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MediaPipePoseEstimator } from './adapters/pose';
import { VideoFrameSource } from './adapters/video';
import { App } from './ui/App';
import type { AnalysisAdapters } from './ui/flow/adapters';

// The one place the browser adapters are built. Everything else receives them.
const adapters: AnalysisAdapters<HTMLVideoElement> = {
  openVideo: (url) => VideoFrameSource.open(url),
  createPoseEstimator: () =>
    new MediaPipePoseEstimator({ wasmBaseUrl: `${import.meta.env.BASE_URL}mediapipe/wasm` }),
};

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

createRoot(root).render(
  <StrictMode>
    <App adapters={adapters} />
  </StrictMode>,
);
