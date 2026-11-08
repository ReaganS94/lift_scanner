import { describe, expect, it } from 'vitest';
import type { LiftPosition, PositionCheck } from '../core';
import { squat } from '../lifts/squat';
import { PORTRAIT_ASPECT, standingFigure } from '../testing/synthetic-pose';
import { analyzePhoto, photoAsClip } from './analyze-photo';
import { prepareClip } from './prepare-clip';

const squatBottom = squat.positions?.find((position) => position.id === 'squat.bottom');

/** The steps the app runs on a photo: one frame, prepared like a clip, then the checks. */
function checkPhoto(position: LiftPosition, view: 'side' | 'front', angleFromSide?: number) {
  const lifter = standingFigure(view);
  // Someone smaller, further back, is in the photo too.
  const passerBy = standingFigure('front').map((point) => ({
    ...point,
    x: point.x * 0.5,
    y: 0.3 + point.y * 0.5,
  }));
  const raw = photoAsClip(
    { timeMs: 1234, landmarks: passerBy, people: [passerBy, lifter] },
    PORTRAIT_ASPECT,
  );
  const prepared = prepareClip(raw);
  if (prepared.torsoLength === null) throw new Error('No torso found');
  return {
    prepared,
    report: analyzePhoto(
      {
        sequence: prepared.sequence,
        view,
        torsoLength: prepared.torsoLength,
        nearSide: prepared.nearSide,
        ...(angleFromSide === undefined ? {} : { angleFromSide }),
      },
      position,
    ),
  };
}

describe('checking a photo', () => {
  it('picks the lifter, not a smaller passer-by, and runs every check of the position', () => {
    if (!squatBottom) throw new Error('Squat has no bottom position');
    const { prepared, report } = checkPhoto(squatBottom, 'side');
    expect(prepared.sequence.frames).toHaveLength(1);
    expect(prepared.torsoLength).toBeCloseTo(0.25, 2);
    expect(report.positionId).toBe('squat.bottom');
    expect(report.results.map((result) => result.checkId)).toEqual(
      squatBottom.checks.map((check) => check.id),
    );
    // Standing isn't the bottom of a squat: depth fails.
    expect(report.results[0]).toMatchObject({ checkId: 'squat.bottom.depth', status: 'fail' });
  });

  it('skips checks the view can’t support', () => {
    if (!squatBottom) throw new Error('Squat has no bottom position');
    const { report } = checkPhoto(squatBottom, 'front');
    expect(report.results.find((r) => r.checkId === 'squat.bottom.depth')).toEqual({
      checkId: 'squat.bottom.depth',
      status: 'skipped',
      message: 'Needs a side view.',
    });
  });

  it('corrects an angled side view before the checks see it', () => {
    let seenX: number | undefined;
    const spy: PositionCheck = {
      id: 'spy',
      label: 'Spy',
      supportedViews: ['side'],
      focus: ['knee'],
      evaluate: ({ pose }) => {
        seenX = pose.landmarks?.[25]?.x;
        return { checkId: 'spy', status: 'skipped', message: '' };
      },
    };
    const position = { id: 'spy', name: 'Spy', description: '', checks: [spy] };
    const straight = checkPhoto(position, 'side');
    const straightX = seenX ?? 0;
    const angled = checkPhoto(position, 'side', 40);
    expect(angled.report.correctedForDegrees).toBe(40);
    expect(straight.report.correctedForDegrees).toBeUndefined();
    expect(Math.abs((seenX ?? 0) - straightX)).toBeGreaterThan(0.001);
  });
});
