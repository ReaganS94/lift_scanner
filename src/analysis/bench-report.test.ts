/**
 * The bench's real checks, run through the whole pipeline (cleanup, rep finding, checks) on
 * synthetic sets, so the pieces are known to fit together.
 */
import { describe, expect, it } from 'vitest';
import { LANDMARK, type Landmark, type LandmarkName, type PoseSequence, type View } from '../core';
import { bench } from '../lifts/bench';
import {
  BENCH_LOCKOUT,
  BENCH_TOUCH,
  betweenHands,
  frontBenchFigure,
  sideBenchFigure,
  type BenchHands,
} from '../testing/bench-pose';
import { jitteredSequence, seededRandom } from '../testing/noise';
import { repWave, sequenceOf } from '../testing/synthetic-pose';
import { analyzeSet } from './analyze-set';
import { prepareClip } from './prepare-clip';

/** Rep amounts from 0 (lockout) to 1 (bar on the chest), with rest at lockout either side. */
const wave = () => repWave({ reps: 1, repFrames: 60, restFrames: 15, amplitude: 1 });

function sideRep(touch: BenchHands, top: BenchHands = BENCH_LOCKOUT): Landmark[][] {
  return wave().map((t) => sideBenchFigure(betweenHands(top, touch, t)));
}

/** A rep seen from the feet; the right hand trails by up to `lag` on the way up. */
function frontRep(lag: number): Landmark[][] {
  return wave().map((t, i) => {
    const rising = i > 45;
    return frontBenchFigure(0.06 + 0.24 * (1 - t), rising ? lag * Math.sin(Math.PI * t) : 0);
  });
}

function report(sequence: PoseSequence, view: View) {
  const prepared = prepareClip(sequence);
  const result = analyzeSet(
    {
      sequence: prepared.sequence,
      view,
      torsoLength: prepared.torsoLength ?? 0,
      nearSide: prepared.nearSide,
    },
    bench,
  );
  return result.reps.map(({ results }) =>
    Object.fromEntries(results.map((r) => [r.checkId, r.status])),
  );
}

describe('bench report', () => {
  it('judges each rep of a side-view set', () => {
    const set = [
      ...sideRep(BENCH_TOUCH),
      ...sideRep(BENCH_TOUCH, { along: 0, height: 0.29 }),
      ...sideRep({ along: 0.7, height: 0.06 }),
    ];
    expect(report(sequenceOf(set), 'side')).toEqual([
      { 'bench.touch-point': 'pass', 'bench.lockout': 'pass', 'bench.uneven-press': 'skipped' },
      { 'bench.touch-point': 'pass', 'bench.lockout': 'fail', 'bench.uneven-press': 'skipped' },
      { 'bench.touch-point': 'warn', 'bench.lockout': 'pass', 'bench.uneven-press': 'skipped' },
    ]);
  });

  it('judges each rep of a set filmed from the feet', () => {
    expect(report(sequenceOf([...frontRep(0), ...frontRep(0.05)]), 'front')).toEqual([
      { 'bench.touch-point': 'skipped', 'bench.lockout': 'skipped', 'bench.uneven-press': 'pass' },
      { 'bench.touch-point': 'skipped', 'bench.lockout': 'skipped', 'bench.uneven-press': 'fail' },
    ]);
  });

  it('counts the reps from the feet despite jitter', () => {
    // From the feet the torso looks short, so the hands' travel is many torso lengths and any
    // jitter at lockout is magnified too. Rep finding has to cope.
    const everyPoint = Object.keys(LANDMARK) as LandmarkName[];
    const random = seededRandom(1);
    const clean = sequenceOf([...frontRep(0), ...frontRep(0)]);
    const miscounts = Array.from(
      { length: 50 },
      () => report(jitteredSequence(clean, everyPoint, 0.006, random), 'front').length,
    ).filter((count) => count !== 2);
    expect(miscounts).toEqual([]);
  });
});
