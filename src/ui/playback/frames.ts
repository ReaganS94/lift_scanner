import type { Rep } from '../../core';

/** A stretch of the clip, as sample frame indices (both ends included). */
export interface FrameRange {
  readonly startFrame: number;
  readonly endFrame: number;
}

/** The rep whose frames include `frame`, if any. */
export function repAtFrame(reps: readonly Rep[], frame: number): Rep | undefined {
  return reps.find((rep) => frame >= rep.startFrame && frame <= rep.endFrame);
}

/** The sample frame shown at a video time. Matches how the skeleton overlay picks its frame. */
export function frameAtTime(seconds: number, sampleFps: number): number {
  return Math.round(seconds * sampleFps);
}

export function timeOfFrame(frame: number, sampleFps: number): number {
  return frame / sampleFps;
}

/** `frame` moved by `delta` frames and kept inside the clip. */
export function stepFrame(frame: number, delta: number, frameCount: number): number {
  return Math.min(Math.max(frame + delta, 0), Math.max(frameCount - 1, 0));
}

export function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(1)} s`;
}
