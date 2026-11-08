/** Brighter than this, on a 0 to 255 scale, and a pixel isn't black. */
const MAX_BLACK_LEVEL = 12;

/**
 * Whether RGBA pixels are all black or close to it. A real gym frame always has something
 * brighter in it, so an all-black frame means the browser drew nothing.
 */
export function looksBlack(rgba: Uint8ClampedArray): boolean {
  for (let at = 0; at < rgba.length; at += 4) {
    if (
      (rgba[at] ?? 0) > MAX_BLACK_LEVEL ||
      (rgba[at + 1] ?? 0) > MAX_BLACK_LEVEL ||
      (rgba[at + 2] ?? 0) > MAX_BLACK_LEVEL
    ) {
      return false;
    }
  }
  return true;
}
