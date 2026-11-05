/** A box on screen, in CSS pixels. */
export interface ScreenBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Where the video's picture is drawn, relative to the overlay's top-left corner. */
export interface PictureBox {
  readonly x: number;
  readonly y: number;
  /** The picture's height: the drawing scale, since positions are in frame heights. */
  readonly height: number;
}

/**
 * Where the picture sits inside a video element shown with `object-fit: contain`: as big as fits,
 * centred, with bars on the sides or top and bottom. Given relative to the overlay, so that the
 * skeleton lines up with the body even when the overlay and the video element differ in size or
 * place, as they can on iPhones.
 *
 * Before the video knows its size (0 by 0), the whole element is taken as the picture.
 */
export function videoPicture(
  overlay: ScreenBox,
  video: ScreenBox,
  videoWidth: number,
  videoHeight: number,
): PictureBox {
  let width = video.width;
  let height = video.height;
  if (videoWidth > 0 && videoHeight > 0 && width > 0 && height > 0) {
    const fit = Math.min(width / videoWidth, height / videoHeight);
    width = videoWidth * fit;
    height = videoHeight * fit;
  }
  return {
    x: video.left - overlay.left + (video.width - width) / 2,
    y: video.top - overlay.top + (video.height - height) / 2,
    height,
  };
}
