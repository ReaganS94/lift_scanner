/** Closes out the previous request, if its input is still around (e.g. `cancel` never fired). */
let abandonPrevious: (() => void) | null = null;

/**
 * Asks for a video or photo and resolves with it, or null if the user backs out. `camera`
 * opens the phone's camera to take one; `library` offers the photo library and files.
 *
 * The file input is made only when asked for, never left in the page. On iOS home-screen apps,
 * a video file input sitting in the page can turn the camera on as soon as the app opens (the
 * green dot), which also pauses music playing in other apps.
 */
export function pickMedia(
  kind: 'video' | 'photo',
  source: 'camera' | 'library',
): Promise<File | null> {
  abandonPrevious?.();
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = kind === 'video' ? 'video/*' : 'image/*';
    if (source === 'camera') input.setAttribute('capture', 'environment');
    input.hidden = true;

    const finish = (file: File | null) => {
      input.remove();
      if (abandonPrevious === abandon) abandonPrevious = null;
      resolve(file);
    };
    const abandon = () => {
      finish(null);
    };
    abandonPrevious = abandon;
    input.addEventListener('change', () => {
      finish(input.files?.[0] ?? null);
    });
    input.addEventListener('cancel', () => {
      finish(null);
    });

    // In the page while the picker is open: some browsers ignore clicks on detached inputs.
    document.body.append(input);
    input.click();
  });
}
