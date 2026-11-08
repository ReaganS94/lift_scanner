import type { FrameRegion, GrayImage, RegionReader } from '../../core';

/** The pictures the app reads: video frames, and photos drawn on a canvas. */
export type FrameImage = HTMLVideoElement | HTMLCanvasElement;

/**
 * Reads part of a video frame or photo through a canvas. One canvas is reused for every frame,
 * since creating one per frame is slow on phones.
 */
export class CanvasRegionReader implements RegionReader<FrameImage> {
  private readonly canvas = document.createElement('canvas');
  private context: CanvasRenderingContext2D | null = null;

  read(image: FrameImage, region: FrameRegion, pixelsPerUnit: number): GrayImage {
    const width = Math.max(1, Math.round(region.width * pixelsPerUnit));
    const height = Math.max(1, Math.round(region.height * pixelsPerUnit));
    const context = this.contextOfSize(width, height);

    // The shared unit is the frame's height, on both axes.
    const unit = image instanceof HTMLVideoElement ? image.videoHeight : image.height;
    context.fillStyle = '#000';
    context.fillRect(0, 0, width, height);
    context.drawImage(
      image,
      region.x * unit,
      region.y * unit,
      region.width * unit,
      region.height * unit,
      0,
      0,
      width,
      height,
    );

    const { data: rgba } = context.getImageData(0, 0, width, height);
    const data = new Uint8ClampedArray(width * height);
    for (let pixel = 0; pixel < data.length; pixel++) {
      const at = pixel * 4;
      // Rec. 601 luma, the usual weighting for brightness.
      data[pixel] =
        0.299 * (rgba[at] ?? 0) + 0.587 * (rgba[at + 1] ?? 0) + 0.114 * (rgba[at + 2] ?? 0);
    }
    return { width, height, data };
  }

  private contextOfSize(width: number, height: number): CanvasRenderingContext2D {
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    // Asked for once: willReadFrequently keeps the canvas in memory the CPU can read quickly.
    this.context ??= this.canvas.getContext('2d', { willReadFrequently: true });
    if (!this.context) throw new Error('This browser cannot read video frames.');
    return this.context;
  }
}
