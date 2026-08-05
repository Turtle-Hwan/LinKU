import { useEffect, useMemo } from "react";

export function useBlobObjectUrl(blob: Blob | null | undefined): string | null {
  const objectUrl = useMemo(
    () => (blob ? URL.createObjectURL(blob) : null),
    [blob],
  );

  useEffect(
    () => () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    },
    [objectUrl],
  );

  return objectUrl;
}
