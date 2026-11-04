import type { FrameSource, SampledFrame } from '../../core';

/**
 * Steps through a video by seeking to each sample time and waiting for that frame.
 * Seeking is slower than playing the video, but it never skips a frame, so every clip is
 * sampled at exactly the requested rate whatever the phone recorded at.
 */
export class VideoFrameSource implements FrameSource<HTMLVideoElement> {
  private readonly video: HTMLVideoElement;

  private constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  /**
   * Loads a video from a URL, such as an object URL for a file the user picked. The caller
   * owns the URL. Call dispose() when finished with the frame source.
   */
  static async open(src: string): Promise<VideoFrameSource> {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true; // iOS would otherwise insist on fullscreen
    video.preload = 'auto';
    video.src = src;
    await waitFor(video, 'loadeddata');
    return new VideoFrameSource(video);
  }

  get durationMs(): number {
    return Number.isFinite(this.video.duration) ? this.video.duration * 1000 : 0;
  }

  get aspectRatio(): number {
    const { videoWidth, videoHeight } = this.video;
    return videoHeight > 0 ? videoWidth / videoHeight : 1;
  }

  async *frames(sampleFps: number): AsyncIterable<SampledFrame<HTMLVideoElement>> {
    const stepMs = 1000 / sampleFps;
    for (let timeMs = 0; timeMs < this.durationMs; timeMs += stepMs) {
      await this.seek(timeMs / 1000);
      yield { timeMs, image: this.video };
    }
  }

  dispose(): void {
    this.video.removeAttribute('src');
    this.video.load();
  }

  private async seek(seconds: number): Promise<void> {
    if (this.video.currentTime === seconds) return;
    const seeked = waitFor(this.video, 'seeked');
    this.video.currentTime = seconds;
    await seeked;
  }
}

function waitFor(video: HTMLVideoElement, event: 'loadeddata' | 'seeked'): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanUp = () => {
      video.removeEventListener(event, onEvent);
      video.removeEventListener('error', onError);
    };
    const onEvent = () => {
      cleanUp();
      resolve();
    };
    const onError = () => {
      cleanUp();
      reject(new Error("This video couldn't be read. Try an MP4 or MOV recorded on your phone."));
    };
    video.addEventListener(event, onEvent);
    video.addEventListener('error', onError);
  });
}
