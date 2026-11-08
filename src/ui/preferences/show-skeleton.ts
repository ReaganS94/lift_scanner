const KEY = 'lift-scanner:show-skeleton';

/**
 * Whether the skeleton is drawn over the results video, remembered between sets. Shown unless
 * it was switched off; storage failures read as the default and saving is best effort.
 */
export function loadShowSkeleton(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'false';
  } catch {
    return true;
  }
}

export function saveShowSkeleton(show: boolean): void {
  try {
    localStorage.setItem(KEY, String(show));
  } catch {
    // Not saved; the next set starts with the skeleton shown.
  }
}
