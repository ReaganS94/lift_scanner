import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  NO_ZOOM,
  clampView,
  isZoomed,
  panBy,
  pinchView,
  settleView,
  zoomAround,
  type Point,
  type Size,
  type ZoomView,
} from './zoom-view';

export interface PinchZoom {
  readonly view: ZoomView;
  readonly zoomed: boolean;
  /** Back to the whole picture. */
  readonly reset: () => void;
  /**
   * True straight after a pinch or drag, so the tap handler can ignore the click some browsers
   * send when the fingers lift.
   */
  readonly justGestured: () => boolean;
}

/** A finger moving less than this is still a tap, which plays or pauses. */
const TAP_SLOP_PX = 8;
/** How long after a gesture a click is taken to be part of it. */
const CLICK_AFTER_GESTURE_MS = 350;
/** How much one notch of a trackpad pinch (a ctrl + wheel event) zooms. */
const WHEEL_ZOOM_RATE = 0.01;

type Gesture =
  | { kind: 'none' }
  | {
      kind: 'pinch';
      start: ZoomView;
      startMidpoint: Point;
      startDistance: number;
    }
  | { kind: 'pan'; last: Point; travelled: number };

/**
 * Pinch to zoom and drag to pan inside one box, without zooming the page around it.
 *
 * Two fingers zoom about their midpoint. Once zoomed, one finger moves the picture; unzoomed,
 * one finger scrolls the page as usual. On a desktop, a trackpad pinch (ctrl + wheel) zooms
 * about the pointer. Touch events rather than pointer events are used because iPhones only let
 * a page stop its own pinch zoom from a touch event.
 */
export function usePinchZoom(boxRef: RefObject<HTMLElement | null>): PinchZoom {
  const [view, setViewState] = useState<ZoomView>(NO_ZOOM);
  const viewRef = useRef(view);
  const lastGestureAt = useRef(-Infinity);

  const setView = useCallback((next: ZoomView) => {
    viewRef.current = next;
    setViewState(next);
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    let gesture: Gesture = { kind: 'none' };
    const size = (): Size => ({ width: box.clientWidth, height: box.clientHeight });
    const local = (x: number, y: number): Point => {
      const rect = box.getBoundingClientRect();
      return { x: x - rect.left, y: y - rect.top };
    };
    const startPinch = (touches: TouchList) => {
      const [a, b] = [touches[0], touches[1]];
      if (!a || !b) return;
      gesture = {
        kind: 'pinch',
        start: viewRef.current,
        startMidpoint: local((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2),
        startDistance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      };
    };
    const startPan = (touch: Touch | undefined) => {
      gesture =
        touch && isZoomed(viewRef.current)
          ? { kind: 'pan', last: { x: touch.clientX, y: touch.clientY }, travelled: 0 }
          : { kind: 'none' };
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length >= 2) {
        event.preventDefault();
        startPinch(event.touches);
      } else {
        startPan(event.touches[0]);
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (gesture.kind === 'pinch' && event.touches.length >= 2) {
        event.preventDefault();
        const [a, b] = [event.touches[0], event.touches[1]];
        if (!a || !b) return;
        lastGestureAt.current = Date.now();
        setView(
          pinchView(
            gesture.start,
            gesture.startMidpoint,
            gesture.startDistance,
            local((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2),
            Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
            size(),
          ),
        );
      } else if (gesture.kind === 'pan' && event.touches.length === 1) {
        const touch = event.touches[0];
        if (!touch) return;
        event.preventDefault();
        const delta = { x: touch.clientX - gesture.last.x, y: touch.clientY - gesture.last.y };
        gesture.last = { x: touch.clientX, y: touch.clientY };
        gesture.travelled += Math.hypot(delta.x, delta.y);
        if (gesture.travelled > TAP_SLOP_PX) lastGestureAt.current = Date.now();
        setView(panBy(viewRef.current, delta, size()));
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (gesture.kind === 'pinch') {
        lastGestureAt.current = Date.now();
        setView(settleView(viewRef.current));
      }
      // Lifting one finger of a pinch carries on as a drag with the other.
      if (event.touches.length >= 2) startPinch(event.touches);
      else startPan(event.touches[0]);
    };

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const current = viewRef.current;
      const scale = current.scale * Math.exp(-event.deltaY * WHEEL_ZOOM_RATE);
      setView(settleView(zoomAround(current, scale, local(event.clientX, event.clientY), size())));
    };

    // Safari's own pinch gesture, which would otherwise zoom the page.
    const stopGesture = (event: Event) => {
      event.preventDefault();
    };

    // A resize or rotation changes the box, so keep the zoomed picture covering it.
    const onResize = () => {
      setView(clampView(viewRef.current, size()));
    };

    const options = { passive: false };
    box.addEventListener('touchstart', onTouchStart, options);
    box.addEventListener('touchmove', onTouchMove, options);
    box.addEventListener('touchend', onTouchEnd);
    box.addEventListener('touchcancel', onTouchEnd);
    box.addEventListener('wheel', onWheel, options);
    box.addEventListener('gesturestart', stopGesture, options);
    box.addEventListener('gesturechange', stopGesture, options);
    window.addEventListener('resize', onResize);
    return () => {
      box.removeEventListener('touchstart', onTouchStart);
      box.removeEventListener('touchmove', onTouchMove);
      box.removeEventListener('touchend', onTouchEnd);
      box.removeEventListener('touchcancel', onTouchEnd);
      box.removeEventListener('wheel', onWheel);
      box.removeEventListener('gesturestart', stopGesture);
      box.removeEventListener('gesturechange', stopGesture);
      window.removeEventListener('resize', onResize);
    };
  }, [boxRef, setView]);

  const reset = useCallback(() => {
    setView(NO_ZOOM);
  }, [setView]);
  const justGestured = useCallback(
    () => Date.now() - lastGestureAt.current < CLICK_AFTER_GESTURE_MS,
    [],
  );

  return { view, zoomed: isZoomed(view), reset, justGestured };
}

/** The CSS transform that shows a zoom view. */
export function zoomTransform({ scale, x, y }: ZoomView): string {
  return `translate(${String(x)}px, ${String(y)}px) scale(${String(scale)})`;
}
