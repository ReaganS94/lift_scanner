import { describe, expect, it } from 'vitest';
import { frameAtTime, repAtFrame, seekTimeOfFrame, stepFrame } from './frames';

const reps = [
  { index: 0, startFrame: 10, turnFrame: 20, endFrame: 30 },
  { index: 1, startFrame: 30, turnFrame: 40, endFrame: 50 },
];

describe('repAtFrame', () => {
  it('finds the rep a frame falls in, including its first and last frame', () => {
    expect(repAtFrame(reps, 10)?.index).toBe(0);
    expect(repAtFrame(reps, 45)?.index).toBe(1);
  });

  it('gives the earlier rep where touch-and-go reps share a frame', () => {
    expect(repAtFrame(reps, 30)?.index).toBe(0);
  });

  it('finds nothing between or outside reps', () => {
    expect(repAtFrame(reps, 5)).toBeUndefined();
    expect(repAtFrame(reps, 51)).toBeUndefined();
  });
});

describe('frameAtTime', () => {
  it('rounds to the nearest sample frame', () => {
    expect(frameAtTime(1.02, 30)).toBe(31);
  });
});

describe('stepFrame', () => {
  it('keeps the frame inside the clip', () => {
    expect(stepFrame(0, -1, 100)).toBe(0);
    expect(stepFrame(99, 1, 100)).toBe(99);
    expect(stepFrame(50, 1, 100)).toBe(51);
  });
});

describe('seekTimeOfFrame', () => {
  it('lands just past the frame start, and still reads back as that frame', () => {
    const time = seekTimeOfFrame(30, 30);
    expect(time).toBeGreaterThan(1);
    expect(frameAtTime(time, 30)).toBe(30);
  });
});
