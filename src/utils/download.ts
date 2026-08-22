/**
 * Hands a generated file to the user.
 *
 * The object URL is released on the next tick, once the anchor click has
 * started the download.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadJson(value: unknown, fileName: string): void {
  downloadBlob(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    fileName,
  );
}
