/**
 * The frame a paused video is showing, as a JPEG file, so it can be checked like a photo. Drawn
 * at the video's full size; browsers draw a video upright, whichever way the phone was held.
 */
export async function captureFrame(video: HTMLVideoElement, fileName: string): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  if (!context || canvas.width === 0 || canvas.height === 0) {
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
