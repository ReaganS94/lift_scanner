/** Saves data as a JSON file on the user's device. */
export function downloadJson(data: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Safari can cancel the download if the URL is released in the same task as the click.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
