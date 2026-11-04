import type { PoseFrame, RepContext } from '../core';

export interface IndexedFrame {
  readonly frame: PoseFrame;
  /** The frame's index in the whole clip, which is what CheckResult.frameIndex expects. */
  readonly index: number;
}

/** The frames of the context's rep, each paired with its index in the whole clip. */
export function repFrames(context: RepContext): IndexedFrame[] {
  const { rep, sequence } = context;
  const frames: IndexedFrame[] = [];
  for (let index = rep.startFrame; index <= rep.endFrame; index++) {
    const frame = sequence.frames[index];
    if (frame) frames.push({ frame, index });
  }
  return frames;
}
