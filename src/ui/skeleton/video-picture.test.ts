import { describe, expect, it } from 'vitest';
import { videoPicture } from './video-picture';

const box = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
});

describe('videoPicture', () => {
  it('fills an element of the same shape as the video', () => {
    const element = box(10, 20, 180, 320);
    expect(videoPicture(element, element, 1080, 1920)).toEqual({ x: 0, y: 0, height: 320 });
  });

  it('centres a portrait video in a wider element, with bars on the sides', () => {
    const element = box(0, 0, 400, 320);
    // 1080x1920 shrunk to 320 tall is 180 wide, leaving 110 on each side.
    expect(videoPicture(element, element, 1080, 1920)).toEqual({ x: 110, y: 0, height: 320 });
  });

  it('centres a landscape video in a taller element, with bars top and bottom', () => {
    const element = box(0, 0, 160, 300);
    // 1920x1080 shrunk to 160 wide is 90 tall, leaving 105 above and below.
    expect(videoPicture(element, element, 1920, 1080)).toEqual({ x: 0, y: 105, height: 90 });
  });

  it('measures from the overlay when it is bigger than the video element', () => {
    // The overlay runs past the video's bottom, as on the iPhone where the skeleton came out
    // too big: the picture's height, not the overlay's, is the scale.
    const overlay = box(0, 0, 180, 370);
    const video = box(0, 0, 180, 320);
    expect(videoPicture(overlay, video, 1080, 1920)).toEqual({ x: 0, y: 0, height: 320 });
  });

  it('allows for the video element being moved inside the overlay', () => {
    const overlay = box(5, 5, 190, 340);
    const video = box(10, 15, 180, 320);
    expect(videoPicture(overlay, video, 1080, 1920)).toEqual({ x: 5, y: 10, height: 320 });
  });

  it('uses the whole element before the video knows its size', () => {
    const element = box(0, 0, 200, 300);
    expect(videoPicture(element, element, 0, 0)).toEqual({ x: 0, y: 0, height: 300 });
  });
});
