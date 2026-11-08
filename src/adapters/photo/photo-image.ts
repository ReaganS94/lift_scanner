/**
 * Photos are scaled down to at most this many pixels on their longer side. The pose model
 * works on a much smaller picture anyway, and a full 48 MP phone photo held as a canvas costs
 * close to 200 MB of memory.
 */
const MAX_SIDE_PIXELS = 2048;
const UNREADABLE = "This photo couldn't be read. Try a JPEG or HEIC taken with your phone.";

/** A photo ready for the pose model and for showing on screen. */
export interface PhotoImage {
  /** The photo, upright and scaled down, as the pose model reads it. */
  readonly image: HTMLCanvasElement;
  /** Width divided by height. */
  readonly aspectRatio: number;
  /**
   * An object URL for the same upright, scaled picture, so what's shown on screen is exactly
   * what the pose was found in. Released by dispose().
   */
  readonly url: string;
  dispose(): void;
}

/**
 * Reads a photo file and draws it upright on a canvas. Phones often save photos sideways with
 * a note saying which way is up (EXIF orientation); decoding with the orientation applied means
 * the pose model and the screen both see it the right way up.
 */
export async function loadPhotoImage(file: Blob): Promise<PhotoImage> {
  const source = await decode(file);
  try {
    const scale = Math.min(1, MAX_SIDE_PIXELS / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error(UNREADABLE);
    context.drawImage(source.image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92);
    });
    if (!blob) throw new Error(UNREADABLE);
    const url = URL.createObjectURL(blob);
    return {
      image: canvas,
      aspectRatio: width / height,
      url,
      dispose() {
        URL.revokeObjectURL(url);
        // Lets the browser free the canvas's memory straight away.
        canvas.width = 0;
        canvas.height = 0;
      },
    };
  } finally {
    source.release();
  }
}

interface Decoded {
  readonly image: CanvasImageSource;
  readonly width: number;
  readonly height: number;
  release(): void;
}

/**
 * createImageBitmap applies the orientation when asked. Where it can't read the file (some
 * browsers can't read HEIC this way), an image element is used instead: browsers draw those
 * upright too.
 */
async function decode(file: Blob): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return {
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => {
        bitmap.close();
      },
    };
  } catch {
    const url = URL.createObjectURL(file);
    const element = new Image();
    element.src = url;
    try {
      await element.decode();
    } catch {
      URL.revokeObjectURL(url);
      throw new Error(UNREADABLE);
    }
    return {
      image: element,
      width: element.naturalWidth,
      height: element.naturalHeight,
      release: () => {
        URL.revokeObjectURL(url);
      },
    };
  }
}
