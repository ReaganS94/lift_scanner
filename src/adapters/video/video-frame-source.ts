import { SEEK_NUDGE_SECONDS, type FrameSource, type SampledFrame } from '../../core';
import { VideoFrameDrawer } from './video-frame-drawer';

/** Loading a picked file is local, so this only trips if the browser can't decode it. */
const LOAD_TIMEOUT_MS = 15_000;
const SEEK_TIMEOUT_MS = 5_000;
/** How long to wait for the new frame to be shown after a seek. */
const FRAME_SHOWN_TIMEOUT_MS = 500;
/**
 * After this many seeks in a row with no frame reported, assume this browser doesn't report
 * frames for paused seeks and rely on the seek event alone for the rest of the clip. More than
 * one, so a single slow frame on a busy phone doesn't turn the check off.
 */
const MAX_FRAME_SHOWN_MISSES = 3;
const UNREADABLE = "This video couldn't be read. Try an MP4 or MOV recorded on your phone.";

/**
 * Steps through a video by seeking to each sample time and waiting for that frame.
 * Seeking is slower than playing the video, but it never skips a frame, so every clip is
 * sampled at exactly the requested rate whatever the phone recorded at.
 */
export class VideoFrameSource implements FrameSource<HTMLVideoElement> {
  private readonly video: HTMLVideoElement;
  /** Seeks in a row where the browser didn't report the new frame in time. */
  private frameShownMisses = 0;
  /** Draws picked frames for drawFrameAt. */
  private readonly drawer = new VideoFrameDrawer();

  private constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  /**
   * Loads a video from a URL, such as an object URL for a file the user picked. The caller
   * owns the URL. Call dispose() when finished with the frame source.
   */
  static async open(src: string): Promise<VideoFrameSource> {
    const video = document.createElement('video');
    // Muted as an attribute and a property, before the source is set, so iOS never treats it
    // as a sound that should pause music in other apps.
    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true; // iOS would otherwise insist on fullscreen
    video.preload = 'auto';
    video.src = src;
    await waitForEvent(video, 'loadeddata', 'opening', LOAD_TIMEOUT_MS, UNREADABLE);
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

  /**
   * Seeks to a time and draws that frame on a canvas, at most `maxSidePixels` on its longer
   * side. For picking one frame: it uses the same seek-and-wait as analysis, which works on
   * iPhones, where a video shown in the page stays black until it has played.
   */
  async drawFrameAt(
    timeMs: number,
    canvas: HTMLCanvasElement,
    maxSidePixels: number,
  ): Promise<void> {
    await this.seek(timeMs / 1000 + SEEK_NUDGE_SECONDS);
    const { video } = this;
    const scale = Math.min(1, maxSidePixels / Math.max(video.videoWidth, video.videoHeight, 1));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    this.drawer.draw(video, canvas, width, height);
  }

  dispose(): void {
    this.drawer.dispose();
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
      'seeking',
      SEEK_TIMEOUT_MS,
      'The video stopped responding while being read.',
    );
    const frameShown =
      this.frameShownMisses < MAX_FRAME_SHOWN_MISSES
        ? waitForFrameShown(video)
        : Promise.resolve(true);

    video.currentTime = seconds;
    const [, shown] = await Promise.all([seeked, frameShown]);
    this.frameShownMisses = shown ? 0 : this.frameShownMisses + 1;
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

/**
 * Waits for a video event. A failure message names the step and the browser's media error
 * code, so a screenshot from a phone says where reading broke.
 */
function waitForEvent(
  video: HTMLVideoElement,
  event: 'loadeddata' | 'seeked',
  step: 'opening' | 'seeking',
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
      const { code, message } = video.error ?? {};
      const detail = code ? `, media error ${code}${message ? `: ${message}` : ''}` : '';
      reject(new Error(`${UNREADABLE} (${step}${detail})`));
    };
    const timer = setTimeout(() => {
      cleanUp();
      reject(new Error(`${failureMessage} (${step} timed out)`));
    }, timeoutMs);
    video.addEventListener(event, onEvent);
    video.addEventListener('error', onError);
  });
}
