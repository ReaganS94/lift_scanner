/**
 * Made-up pictures of a plate, for testing the bar tracker. A scene is drawn in the shared unit
 * (frame heights), and read back at any scale like a RegionReader would.
 */
import type { FrameRegion, GrayImage } from '../core';
import { gaussian, seededRandom } from './noise';

export interface Disk {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface SceneOptions {
  /** Brightness of the plate, 0 to 255. */
  readonly plate?: number;
  /** Brightness of everything behind it. */
  readonly background?: number;
  /** Standard deviation of brightness noise added to every pixel. */
  readonly noise?: number;
  readonly seed?: number;
  /** Other disks to draw first, such as a smaller round thing nearby. */
  readonly distractors?: readonly (Disk & { readonly shade: number })[];
}

/**
 * Reads `region` of a frame showing `disk` at `pixelsPerUnit`, with edges smoothed by drawing
 * each pixel from 4×4 samples, as a camera would blend them.
 */
export function readScene(
  disk: Disk | null,
  region: FrameRegion,
  pixelsPerUnit: number,
  options: SceneOptions = {},
): GrayImage {
  const { plate = 30, background = 170, noise = 0, seed = 1, distractors = [] } = options;
  const width = Math.max(1, Math.round(region.width * pixelsPerUnit));
  const height = Math.max(1, Math.round(region.height * pixelsPerUnit));
  const data = new Uint8ClampedArray(width * height);
  const random = seededRandom(seed);
  const unitsPerPixel = region.width / width;
  const shapes = [...distractors, ...(disk ? [{ ...disk, shade: plate }] : [])];
  const SUB = 4;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      let sum = 0;
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const x = region.x + (px + (sx + 0.5) / SUB) * unitsPerPixel;
          const y = region.y + (py + (sy + 0.5) / SUB) * unitsPerPixel;
          let shade = background;
          for (const shape of shapes) {
            if (Math.hypot(x - shape.x, y - shape.y) <= shape.radius) shade = shape.shade;
          }
          sum += shade;
        }
      }
      data[py * width + px] = sum / (SUB * SUB) + (noise > 0 ? gaussian(random, noise) : 0);
    }
  }
  return { width, height, data };
}
