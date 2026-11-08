import { describe, expect, it } from 'vitest';
import { liftRegistry } from './registry';

const positions = liftRegistry
  .all()
  .flatMap((lift) => (lift.positions ?? []).map((position) => ({ lift, position })));

describe('every registered position', () => {
  it('has an id that is unique across lifts and starts with its lift', () => {
    const ids = positions.map(({ position }) => position.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { lift, position } of positions) expect(position.id).toMatch(`${lift.id}.`);
  });

  it.each(positions.map(({ position }) => [position.id, position] as const))(
    '%s has checks with unique ids, each naming the joints to highlight',
    (_id, position) => {
      expect(position.checks.length).toBeGreaterThan(0);
      const ids = position.checks.map((check) => check.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const check of position.checks) {
        expect(check.id.startsWith(`${position.id}.`)).toBe(true);
        expect(check.focus.length).toBeGreaterThan(0);
      }
    },
  );
});
