/**
 * The frame a paused video is showing, as a JPEG file, so it can be checked like a photo. Drawn
 * at the video's full size; browsers draw a video upright, whichever way the phone was held.
 */
export async function captureFrame(video: HTMLVideoElement, fileName: string): Promise<File> {
  await frameReady(video);
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  if (
    !context ||
    canvas.width === 0 ||
    canvas.height === 0 ||
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
  ) {
    throw new Error("This frame couldn't be read from the video.");
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.95);
  });
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) throw new Error("This frame couldn't be read from the video.");
  return new File([blob], fileName, { type: 'image/jpeg' });
}

/** Longest wait for a seek or the first frame to finish before capturing anyway. */
const READY_TIMEOUT_MS = 3000;

/**
 * Waits until the video has the frame it's showing decoded. Right after a step or a scrub the
 * seek may still be running, and Safari then draws the previous frame or a black one.
 */
function frameReady(video: HTMLVideoElement): Promise<void> {
  if (!video.seeking && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener('seeked', check);
      video.removeEventListener('loadeddata', check);
      resolve();
    };
    const check = () => {
      if (!video.seeking && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) done();
    };
    const timer = setTimeout(done, READY_TIMEOUT_MS);
    video.addEventListener('seeked', check);
    video.addEventListener('loadeddata', check);
  });
}
