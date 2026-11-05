/** A greyscale picture: one byte per pixel, row by row from the top left. */
export interface GrayImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array | Uint8ClampedArray;
}

/** A rectangle of the frame, in the shared unit (see Landmark): frame heights from the top left. */
export interface FrameRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
