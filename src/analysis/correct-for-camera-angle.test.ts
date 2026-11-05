import { describe, expect, it } from 'vitest';
import { LANDMARK, type Landmark, type PoseSequence } from '../core';
import { forwardTilt, sidePoint } from '../geometry';
import { moved, sequenceOf, standingFigure } from '../testing/synthetic-pose';
import { correctForCameraAngle, MAX_CORRECTED_DEGREES } from './correct-for-camera-angle';

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** A side-view figure whose shoulders lean `lean` degrees forward of the hips. */
function leaning(lean: number): Landmark[] {
  const figure = standingFigure('side');
  const hip = figure[LANDMARK.leftHip];
  const shoulder = figure[LANDMARK.leftShoulder];
  if (!hip || !shoulder) throw new Error('figure without a hip or shoulder');
  const torso = hip.y - shoulder.y;
  const dx = hip.x + torso * Math.sin(radians(lean)) - shoulder.x;
  const dy = hip.y - torso * Math.cos(radians(lean)) - shoulder.y;
  return moved(figure, ['leftShoulder', 'rightShoulder'], dx, dy);
}

/** The same figure as a camera turned `degrees` off side-on sees it: squashed sideways. */
function filmedAt(figure: Landmark[], degrees: number): Landmark[] {
  const centre = figure[LANDMARK.leftHip]?.x ?? 0;
  const squash = Math.cos(radians(degrees));
  return figure.map((point) => ({ ...point, x: centre + (point.x - centre) * squash }));
}

function lean(sequence: PoseSequence): number | null {
  const frame = sequence.frames[0];
  if (!frame) return null;
  const hip = sidePoint(frame, 'left', 'Hip');
  const shoulder = sidePoint(frame, 'left', 'Shoulder');
  return hip && shoulder ? forwardTilt(hip, shoulder, 1) : null;
}

describe('correctForCameraAngle', () => {
  it('restores a forward lean filmed 40 degrees off side-on', () => {
    const angled = sequenceOf([filmedAt(leaning(55), 40)]);
    expect(lean(angled)).toBeCloseTo(47.5, 0);
    expect(lean(correctForCameraAngle(angled, 40))).toBeCloseTo(55, 0);
  });

  it('leaves heights alone', () => {
    const angled = sequenceOf([filmedAt(leaning(30), 30)]);
    const corrected = correctForCameraAngle(angled, 30);
    expect(corrected.frames[0]?.landmarks?.map((p) => p.y)).toEqual(
      angled.frames[0]?.landmarks?.map((p) => p.y),
    );
  });

  it(`stretches no further than for ${String(MAX_CORRECTED_DEGREES)} degrees`, () => {
    const angled = sequenceOf([filmedAt(leaning(30), 70)]);
    expect(correctForCameraAngle(angled, 70)).toEqual(
      correctForCameraAngle(angled, MAX_CORRECTED_DEGREES),
    );
  });

  it('stretches the bar track about the same point', () => {
    const figure = filmedAt(leaning(0), 40);
    const hipX = ((figure[LANDMARK.leftHip]?.x ?? 0) + (figure[LANDMARK.rightHip]?.x ?? 0)) / 2;
    const sequence: PoseSequence = {
      ...sequenceOf([figure]),
      barTrack: [{ x: hipX + 0.1, y: 0.8, radius: 0.1, confidence: 1 }],
    };
    const point = correctForCameraAngle(sequence, 40).barTrack?.[0];
    expect(point?.x).toBeCloseTo(hipX + 0.1 / Math.cos(radians(40)), 6);
    expect(point?.radius).toBe(0.1);
  });

  it('changes nothing for a straight side-on clip', () => {
    const sequence = sequenceOf([leaning(20)]);
    expect(correctForCameraAngle(sequence, 0)).toBe(sequence);
  });
});
