import type { FrameSource, SampledFrame } from '../../core';

/** Loading a picked file is local, so this only trips if the browser can't decode it. */
const LOAD_TIMEOUT_MS = 15_000;
const SEEK_TIMEOUT_MS = 5_000;
/**
 * How long to wait for the new frame after a seek before deciding this browser doesn't report
 * frames for paused seeks, and relying on the seek event alone for the rest of the clip.
 */
const FRAME_SHOWN_TIMEOUT_MS = 500;
/**
 * Sample times are nudged just past each frame boundary: seeking to exactly 1/30 s on a 30 fps
 * video can land on either neighbouring frame because of rounding.
 */
const SEEK_NUDGE_SECONDS = 0.001;

const UNREADABLE = "This video couldn't be read. Try an MP4 or MOV recorded on your phone.";

/**
 * Steps through a video by seeking to each sample time and waiting for that frame.
 * Seeking is slower than playing the video, but it never skips a frame, so every clip is
 * sampled at exactly the requested rate whatever the phone recorded at.
 */
export class VideoFrameSource implements FrameSource<HTMLVideoElement> {
  private readonly video: HTMLVideoElement;
  /** Turned off if the browser doesn't report frames for paused seeks. */
  private waitForFrameShown = true;

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
    await waitForEvent(video, 'loadeddata', LOAD_TIMEOUT_MS, UNREADABLE);
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
      await this.seek(timeMs / 1000 + SEEK_NUDGE_SECONDS);
      yield { timeMs, image: this.video };
    }
  }

  dispose(): void {
    this.video.removeAttribute('src');
    this.video.load();
  }

  /**
   * Seeks and waits until the new frame can be drawn. Safari can report the seek as done
   * before the frame is decoded, which would hand the pose model the previous frame, so where
   * the browser supports it this also waits for the frame to be shown.
   */
  private async seek(seconds: number): Promise<void> {
    const { video } = this;
    const seeked = waitForEvent(
      video,
      'seeked',
      SEEK_TIMEOUT_MS,
      'The video stopped responding while being read.',
    );
    const frameShown = this.waitForFrameShown ? waitForFrameShown(video) : Promise.resolve(true);

    video.currentTime = seconds;
    const [, shown] = await Promise.all([seeked, frameShown]);
    if (!shown) this.waitForFrameShown = false;
  }
}

/** Resolves true once the video shows a new frame, or false if it can't tell in time. */
function waitForFrameShown(video: HTMLVideoElement): Promise<boolean> {
  if (!('requestVideoFrameCallback' in video)) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      video.cancelVideoFrameCallback(handle);
      resolve(false);
    }, FRAME_SHOWN_TIMEOUT_MS);
    const handle = video.requestVideoFrameCallback(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

function waitForEvent(
  video: HTMLVideoElement,
  event: 'loadeddata' | 'seeked',
  timeoutMs: number,
  failureMessage: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanUp = () => {
      clearTimeout(timer);
      video.removeEventListener(event, onEvent);
      video.removeEventListener('error', onError);
    };
    const onEvent = () => {
      cleanUp();
      resolve();
    };
    const onError = () => {
      cleanUp();
      reject(new Error(UNREADABLE));
    };
    const timer = setTimeout(() => {
      cleanUp();
      reject(new Error(failureMessage));
    }, timeoutMs);
    video.addEventListener(event, onEvent);
    video.addEventListener('error', onError);
  });
}
