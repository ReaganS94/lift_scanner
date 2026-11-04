/**
 * Opens the phone's camera to record a video, and resolves with the recording, or null if the
 * user backs out.
 *
 * The file input is made only when asked for, never left in the page. On iOS home-screen apps,
 * a file input with `capture` sitting in the page turns the camera on as soon as the app opens
 * (the green dot), which also pauses music playing in other apps.
 */
export function recordVideo(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.setAttribute('capture', 'environment');
    input.hidden = true;

    const finish = (file: File | null) => {
      input.remove();
      resolve(file);
    };
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
