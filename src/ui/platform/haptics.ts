/**
 * A short buzz, where the phone supports it (Android browsers; iPhones ignore it). Never
 * throws: haptics are a nicety.
 */
export function buzz(pattern: number | number[]): void {
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    // Unsupported or blocked; nothing to do.
  }
}
