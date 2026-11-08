import { describe, expect, it } from 'vitest';
import { playerClassName, videoFrameStyle } from './player-layout';

describe('playerClassName', () => {
  it('puts the controls beside a portrait phone video', () => {
    expect(playerClassName(1080 / 1920)).toBe('player player--side');
    expect(playerClassName(3 / 4)).toBe('player player--side');
  });

  it('keeps the controls under square and landscape videos', () => {
    expect(playerClassName(1)).toBe('player');
    expect(playerClassName(1920 / 1080)).toBe('player');
  });
});

describe('videoFrameStyle', () => {
  it('sizes the box to the video, capped by height', () => {
    expect(videoFrameStyle(0.5, '42svh')).toEqual({
      aspectRatio: '0.5',
      width: 'min(100%, calc(42svh * 0.5))',
    });
  });
});
