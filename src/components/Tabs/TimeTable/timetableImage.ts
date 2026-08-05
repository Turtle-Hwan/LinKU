const BYTES_PER_MEBIBYTE = 1024 * 1024;
const MAX_TIMETABLE_IMAGE_SIZE_MB = 8;
const PNG_FILE_SIGNATURE = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10,
]);

export const TIMETABLE_PNG_REQUIREMENTS = {
  maxByteSize: MAX_TIMETABLE_IMAGE_SIZE_MB * BYTES_PER_MEBIBYTE,
  maxSizeLabel: `${MAX_TIMETABLE_IMAGE_SIZE_MB}MB`,
  minWidth: 280,
  minHeight: 180,
} as const;

export interface TimetablePng {
  blob: Blob;
  width: number;
  height: number;
}

export async function readTimetablePng(file: File): Promise<TimetablePng> {
  if (file.size > TIMETABLE_PNG_REQUIREMENTS.maxByteSize) {
    throw new Error(
      `${TIMETABLE_PNG_REQUIREMENTS.maxSizeLabel} 이하 PNG 파일을 올려주세요.`,
    );
  }

  const bytes = new Uint8Array(
    await file.slice(0, PNG_FILE_SIGNATURE.byteLength).arrayBuffer(),
  );
  const hasPngSignature = PNG_FILE_SIGNATURE.every(
    (expected, index) => bytes[index] === expected,
  );

  if (!hasPngSignature) {
    throw new Error("PNG 형식의 시간표 이미지만 올릴 수 있습니다.");
  }

  const blob =
    file.type === "image/png"
      ? file
      : new Blob([await file.arrayBuffer()], { type: "image/png" });
  const bitmap = await createImageBitmap(blob);

  try {
    const { minWidth, minHeight } = TIMETABLE_PNG_REQUIREMENTS;
    if (bitmap.width < minWidth || bitmap.height < minHeight) {
      throw new Error("시간표를 확인할 수 있는 크기의 이미지를 올려주세요.");
    }

    return {
      blob,
      width: bitmap.width,
      height: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}
