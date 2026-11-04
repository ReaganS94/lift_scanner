import { describe, expect, it } from 'vitest';
import type { LiftDefinition } from '../core';
import { createLiftRegistry } from './registry';

function fakeLift(id: string): LiftDefinition {
  return {
    id,
    name: id,
    supportedViews: ['side'],
    repSignal: () => [],
    repDetection: { minAmplitude: 0.1, minDurationSeconds: 0.5 },
    checks: [],
  };
}

describe('createLiftRegistry', () => {
  it('finds a lift by id', () => {
    const squat = fakeLift('squat');
    const registry = createLiftRegistry([squat, fakeLift('bench')]);
    expect(registry.get('squat')).toBe(squat);
    expect(registry.get('row')).toBeUndefined();
  });

  it('lists lifts in the order they were registered', () => {
    const registry = createLiftRegistry([fakeLift('squat'), fakeLift('bench')]);
    expect(registry.all().map((lift) => lift.id)).toEqual(['squat', 'bench']);
  });

  it('rejects two lifts with the same id', () => {
    expect(() => createLiftRegistry([fakeLift('squat'), fakeLift('squat')])).toThrow(/squat/);
  });
});
