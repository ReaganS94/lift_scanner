import { describe, expect, it } from 'vitest';
import { liftRegistry } from './registry';

describe('every registered check', () => {
  const checks = liftRegistry.all().flatMap((lift) => lift.checks);

  it.each(checks.map((check) => [check.id, check] as const))(
    '%s names the joints to highlight on the video',
    (_id, check) => {
      expect(check.focus?.length).toBeGreaterThan(0);
    },
  );
});
