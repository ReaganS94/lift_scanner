import { describe, expect, it } from 'vitest';
import { bothSides, photoPose, towards, type Point } from '../../../../testing/photo-pose';
import { forearmsVertical } from './forearms-vertical';
import { bottomTouchPoint } from './touch-point';

/** Lying on the bench, filmed from the side, with the head on the left of the photo. */
const SHOULDER: Point = { x: 0.1, y: 0.5 };
const HIP: Point = { x: 0.4, y: 0.5 };

/** The bar on the chest with the forearm tilted `tilt` degrees towards the feet. */
function sideBottom(tilt: number, elbowX = 0.18) {
  const elbow = { x: elbowX, y: 0.56 };
  return photoPose({
    ...bothSides('Shoulder', SHOULDER),
    ...bothSides('Hip', HIP),
    ...bothSides('Elbow', elbow),
    ...bothSides('Wrist', towards(elbow, tilt, 0.15)),
  });
}

describe('bench bottom photo: forearms vertical', () => {
  it('passes a forearm stacked over the elbow', () => {
    expect(forearmsVertical.evaluate(sideBottom(5))).toMatchObject({
      status: 'pass',
      frameIndex: 0,
    });
  });

  it('says which way a leaning forearm leans', () => {
    expect(forearmsVertical.evaluate(sideBottom(25))).toMatchObject({
      status: 'warn',
      message: 'Forearms lean 25° towards your feet: the wrists are ahead of the elbows.',
    });
    expect(forearmsVertical.evaluate(sideBottom(-25))).toMatchObject({
      status: 'warn',
      message: 'Forearms lean 25° towards your head: the wrists are behind the elbows.',
    });
  });

  it('from the head end, tells a grip wider than the elbows', () => {
    const centre = 0.28;
    const wide = photoPose(
      {
        leftElbow: { x: centre + 0.15, y: 0.6 },
        rightElbow: { x: centre - 0.15, y: 0.6 },
        leftWrist: { x: centre + 0.22, y: 0.45 },
        rightWrist: { x: centre - 0.16, y: 0.45 },
      },
      { view: 'front' },
    );
    expect(forearmsVertical.evaluate(wide)).toMatchObject({
      status: 'warn',
      message: expect.stringContaining('outwards') as string,
    });
  });
});

describe('bench bottom photo: touch point', () => {
  it('reads where the bar touches from the wrist, like the video check', () => {
    expect(bottomTouchPoint.evaluate(sideBottom(0))).toMatchObject({
      status: 'pass',
      message: 'The bar touched the upper chest.',
    });
    expect(bottomTouchPoint.evaluate(sideBottom(0, 0.32))).toMatchObject({ status: 'warn' });
  });
});
