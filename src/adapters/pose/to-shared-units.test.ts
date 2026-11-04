import { describe, expect, it } from 'vitest';
import { angleFromVertical } from '../../geometry';
import { toSharedUnits } from './to-shared-units';

describe('toSharedUnits', () => {
  it('keeps a true 45° angle at 45° on a portrait 9:16 clip', () => {
    const width = 1080;
    const height = 1920;
    // A segment going 100 px right and 100 px up, in MediaPipe's normalised coordinates.
    const hip = { x: 500 / width, y: 1000 / height, z: 0, visibility: 1 };
    const shoulder = { x: 600 / width, y: 900 / height, z: 0, visibility: 1 };

    const [from, to] = toSharedUnits([hip, shoulder], width / height);
    if (!from || !to) throw new Error('missing landmarks');
    expect(angleFromVertical(from, to)).toBeCloseTo(45);
  });

  it('would read about 61° from vertical (29° from horizontal) without the conversion', () => {
    // Guards the test above: the raw coordinates really are distorted.
    const raw = angleFromVertical(
      { x: 500 / 1080, y: 1000 / 1920 },
      { x: 600 / 1080, y: 900 / 1920 },
    );
    expect(raw).toBeCloseTo(60.6, 0);
  });

  it('treats a missing visibility as not seen', () => {
    expect(toSharedUnits([{ x: 0.5, y: 0.5, z: 0 }], 1)[0]?.visibility).toBe(0);
  });
});
