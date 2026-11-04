import type { LiftDefinition } from '../core';

/** Looks up the lifts the app supports. Add a lift by passing its definition to the registry. */
export interface LiftRegistry {
  all(): readonly LiftDefinition[];
  get(id: string): LiftDefinition | undefined;
}

export function createLiftRegistry(lifts: readonly LiftDefinition[]): LiftRegistry {
  const byId = new Map<string, LiftDefinition>();
  for (const lift of lifts) {
    if (byId.has(lift.id)) {
      throw new Error(`Two lifts are registered with the id "${lift.id}".`);
    }
    byId.set(lift.id, lift);
  }

  return {
    all: () => [...byId.values()],
    get: (id) => byId.get(id),
  };
}

/** The lifts available in the app. Squat, deadlift and bench are added here as they're built. */
export const liftRegistry: LiftRegistry = createLiftRegistry([]);
