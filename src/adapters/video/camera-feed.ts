/** Shown when the browser refuses the camera, or has none. */
const NO_CAMERA =
  "Couldn't open the camera. Allow camera access for this site in your browser settings and try again.";
const LOAD_TIMEOUT_MS = 10_000;

/**
 * The phone's back camera, live, for the framing check. No sound is asked for. On iPhones, an
 * open camera still pauses music in other apps until stop() is called.
 */
export class CameraFeed {
  readonly video: HTMLVideoElement;
  private readonly stream: MediaStream;

  private constructor(video: HTMLVideoElement, stream: MediaStream) {
    this.video = video;
    this.stream = stream;
  }

  static async open(): Promise<CameraFeed> {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
    } catch {
      throw new Error(NO_CAMERA);
    }

    const video = document.createElement('video');
    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true; // iOS would otherwise insist on fullscreen
    video.srcObject = stream;
    const feed = new CameraFeed(video, stream);
    try {
      await waitForPicture(video);
      await video.play();
    } catch (error) {
      feed.stop();
      throw error instanceof Error ? error : new Error(NO_CAMERA);
    }
    return feed;
  }

  /** The picture's width divided by its height; follows the phone being turned. */
  get aspectRatio(): number {
    const { videoWidth, videoHeight } = this.video;
    return videoHeight > 0 ? videoWidth / videoHeight : 1;
  }

  /** Turns the camera off. Safe to call more than once. */
  stop(): void {
    for (const track of this.stream.getTracks()) track.stop();
    this.video.srcObject = null;
  }
}

function waitForPicture(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      video.removeEventListener('loadeddata', done);
      reject(new Error(NO_CAMERA));
    }, LOAD_TIMEOUT_MS);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    video.addEventListener('loadeddata', done, { once: true });
  });
}
