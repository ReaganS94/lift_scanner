import { describe, expect, it } from 'vitest';
import type { BarPoint } from '../core';
import { MAX_MISSES } from './plate-tracker';
import { trustedPlates } from './trusted-plates';

const at = (confidence: number): BarPoint => ({ x: 1, y: 0.8, radius: 0.1, confidence });
const lost = (frames: number) => Array.from({ length: frames }, () => null);

describe('trustedPlates', () => {
  it('keeps a clean lock whole, including frames where its score dips', () => {
    const track = [at(0.85), at(0.8), at(0.6), at(0.55), at(0.82), at(0.9)];
    expect(trustedPlates(track)).toEqual(track);
  });

  it('drops a weak lock, even on its odd good frame', () => {
    const track = [at(0.5), at(0.45), at(0.75), at(0.5), at(0.55)];
    expect(trustedPlates(track)).toEqual(lost(5));
  });

  it('keeps short gaps in a lock as gaps', () => {
    const track = [at(0.8), ...lost(MAX_MISSES), at(0.8)];
    expect(trustedPlates(track)).toEqual(track);
  });

  it('judges each lock on its own once the plate was lost long enough to look afresh', () => {
    const good = [at(0.85), at(0.85), at(0.85)];
    const weak = [at(0.4), at(0.4), at(0.4)];
    const track = [...good, ...lost(MAX_MISSES + 1), ...weak];
    expect(trustedPlates(track)).toEqual([...good, ...lost(MAX_MISSES + 1), ...lost(3)]);
  });
});
