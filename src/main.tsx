import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MediaPipePoseEstimator } from './adapters/pose';
import { CameraFeed, CanvasRegionReader, VideoFrameSource } from './adapters/video';
import { App } from './ui/App';
import { UpdateNotice } from './ui/components/UpdateNotice';
import type { AnalysisAdapters } from './ui/flow/adapters';
import { letOtherAudioKeepPlaying } from './ui/platform/audio-session';

// The one place the browser adapters are built. Everything else receives them.
const adapters: AnalysisAdapters<HTMLVideoElement> = {
  openVideo: (url) => VideoFrameSource.open(url),
  createPoseEstimator: () =>
    new MediaPipePoseEstimator({ wasmBaseUrl: `${import.meta.env.BASE_URL}mediapipe/wasm` }),
  createRegionReader: () => new CanvasRegionReader(),
  openCamera: async () => {
    const feed = await CameraFeed.open();
    return {
      show: (container, className) => {
        feed.video.className = className;
        container.prepend(feed.video);
        return () => {
          feed.video.remove();
        };
      },
      image: feed.video,
      get aspectRatio() {
        return feed.aspectRatio;
      },
      stop: () => {
        feed.stop();
      },
    };
  },
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
