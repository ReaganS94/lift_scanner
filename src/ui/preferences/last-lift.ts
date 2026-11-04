const KEY = 'lift-scanner:last-lift';

/**
 * The lift picked last time, so the start screen can preselect it. Storage can be missing or
 * blocked (private browsing), so failures read as "nothing saved" and saving is best effort.
 */
export function loadLastLift(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveLastLift(liftId: string): void {
  try {
    localStorage.setItem(KEY, liftId);
  } catch {
    // Not saved; the next visit starts on the default lift.
  }
}
