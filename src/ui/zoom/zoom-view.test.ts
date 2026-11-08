import { describe, expect, it } from 'vitest';
import {
  MAX_SCALE,
  NO_ZOOM,
  clampView,
  isZoomed,
  panBy,
  pinchView,
  settleView,
  zoomAround,
  type ZoomView,
} from './zoom-view';

const size = { width: 200, height: 400 };

/** Where a point of the unzoomed picture ends up on screen. */
function onScreen(view: ZoomView, x: number, y: number) {
  return { x: view.x + x * view.scale, y: view.y + y * view.scale };
}

describe('clampView', () => {
  it('never zooms out past the whole picture or in past the maximum', () => {
    expect(clampView({ scale: 0.5, x: 10, y: 10 }, size)).toEqual(NO_ZOOM);
    expect(clampView({ scale: 9, x: 0, y: 0 }, size).scale).toBe(MAX_SCALE);
  });

  it('keeps the picture covering the box', () => {
    expect(clampView({ scale: 2, x: 50, y: -1000 }, size)).toEqual({ scale: 2, x: 0, y: -400 });
  });
});

describe('zoomAround', () => {
  it('keeps the spot under the point where it is', () => {
    const view = zoomAround(NO_ZOOM, 2, { x: 100, y: 200 }, size);
    expect(view.scale).toBe(2);
    expect(onScreen(view, 100, 200)).toEqual({ x: 100, y: 200 });
  });

  it('zooms from a corner without leaving empty space', () => {
    const view = zoomAround(NO_ZOOM, 3, { x: 0, y: 0 }, size);
    expect(view).toEqual({ scale: 3, x: 0, y: 0 });
  });
});

describe('pinchView', () => {
  it('scales with the distance between the fingers', () => {
    const mid = { x: 100, y: 200 };
    expect(pinchView(NO_ZOOM, mid, 50, mid, 125, size).scale).toBe(2.5);
  });

  it('carries the pinched spot along with the fingers', () => {
    const start = zoomAround(NO_ZOOM, 2, { x: 100, y: 200 }, size);
    const view = pinchView(start, { x: 100, y: 200 }, 50, { x: 120, y: 180 }, 50, size);
    expect(onScreen(view, 100, 200)).toEqual({ x: 120, y: 180 });
  });

  it('ignores a pinch that starts with both fingers on one spot', () => {
    const mid = { x: 10, y: 10 };
    expect(pinchView(NO_ZOOM, mid, 0, mid, 80, size)).toBe(NO_ZOOM);
  });
});

describe('panBy', () => {
  it('moves a zoomed picture, but not past its edges', () => {
    const view = { scale: 2, x: -100, y: -200 };
    expect(panBy(view, { x: 30, y: -40 }, size)).toEqual({ scale: 2, x: -70, y: -240 });
    expect(panBy(view, { x: 500, y: 0 }, size).x).toBe(0);
  });

  it('does nothing to an unzoomed picture', () => {
    expect(panBy(NO_ZOOM, { x: 30, y: 30 }, size)).toEqual(NO_ZOOM);
  });
});

describe('settleView', () => {
  it('snaps a barely zoomed picture back to the whole picture', () => {
    expect(settleView({ scale: 1.03, x: -2, y: -3 })).toBe(NO_ZOOM);
    expect(isZoomed(settleView({ scale: 1.5, x: 0, y: 0 }))).toBe(true);
  });
});
