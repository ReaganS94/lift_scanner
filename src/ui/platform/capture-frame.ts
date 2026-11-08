/** A canvas's picture as a JPEG file, so a frame picked from a video can be checked as a photo. */
export async function canvasToFile(canvas: HTMLCanvasElement, fileName: string): Promise<File> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.95);
  });
  if (!blob) throw new Error("This frame couldn't be saved.");
  return new File([blob], fileName, { type: 'image/jpeg' });
}
