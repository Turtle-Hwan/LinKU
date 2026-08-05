import {
  TIMETABLE_IMAGE_MIME_TYPES,
  type TimetableImageMimeType,
} from "@/types/timetable";

const BYTES_PER_MEBIBYTE = 1024 * 1024;
const MAX_TIMETABLE_IMAGE_SIZE_MB = 8;
const IMAGE_SIGNATURE_BYTE_LENGTH = 32;
const SUPPORTED_IMAGE_FORMAT_LABEL = "PNG, JPG, JPEG, WebP, GIF, AVIF";
const PNG_FILE_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;
const JPEG_FILE_SIGNATURE = [255, 216, 255] as const;
const GIF87A_FILE_SIGNATURE = [71, 73, 70, 56, 55, 97] as const;
const GIF89A_FILE_SIGNATURE = [71, 73, 70, 56, 57, 97] as const;
const RIFF_FILE_SIGNATURE = [82, 73, 70, 70] as const;
const WEBP_FILE_SIGNATURE = [87, 69, 66, 80] as const;
const FTYP_FILE_SIGNATURE = [102, 116, 121, 112] as const;
const AVIF_FILE_SIGNATURE = [97, 118, 105, 102] as const;
const AVIS_FILE_SIGNATURE = [97, 118, 105, 115] as const;

export const TIMETABLE_IMAGE_ACCEPT = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".avif",
  ...TIMETABLE_IMAGE_MIME_TYPES,
].join(",");

export const TIMETABLE_IMAGE_REQUIREMENTS = {
  maxByteSize: MAX_TIMETABLE_IMAGE_SIZE_MB * BYTES_PER_MEBIBYTE,
  maxSizeLabel: `${MAX_TIMETABLE_IMAGE_SIZE_MB}MB`,
  minWidth: 280,
  minHeight: 180,
  supportedFormatLabel: SUPPORTED_IMAGE_FORMAT_LABEL,
} as const;

export interface TimetableImage {
  blob: Blob;
  width: number;
  height: number;
}

function startsWithBytes(
  bytes: Uint8Array,
  signature: readonly number[],
  offset = 0,
): boolean {
  return signature.every(
    (expected, index) => bytes[offset + index] === expected,
  );
}

function includesAlignedBytes(
  bytes: Uint8Array,
  signature: readonly number[],
  startOffset: number,
): boolean {
  for (
    let offset = startOffset;
    offset <= bytes.length - signature.length;
    offset += 4
  ) {
    if (startsWithBytes(bytes, signature, offset)) {
      return true;
    }
  }

  return false;
}

function detectImageMimeType(
  bytes: Uint8Array,
): TimetableImageMimeType | null {
  if (startsWithBytes(bytes, PNG_FILE_SIGNATURE)) {
    return "image/png";
  }

  if (startsWithBytes(bytes, JPEG_FILE_SIGNATURE)) {
    return "image/jpeg";
  }

  if (
    startsWithBytes(bytes, GIF87A_FILE_SIGNATURE) ||
    startsWithBytes(bytes, GIF89A_FILE_SIGNATURE)
  ) {
    return "image/gif";
  }

  if (
    startsWithBytes(bytes, RIFF_FILE_SIGNATURE) &&
    startsWithBytes(bytes, WEBP_FILE_SIGNATURE, 8)
  ) {
    return "image/webp";
  }

  if (
    startsWithBytes(bytes, FTYP_FILE_SIGNATURE, 4) &&
    (includesAlignedBytes(bytes, AVIF_FILE_SIGNATURE, 8) ||
      includesAlignedBytes(bytes, AVIS_FILE_SIGNATURE, 8))
  ) {
    return "image/avif";
  }

  return null;
}

async function decodeImage(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob);
  } catch {
    throw new Error("손상되었거나 브라우저에서 읽을 수 없는 이미지입니다.");
  }
}

export async function readTimetableImage(
  file: File,
): Promise<TimetableImage> {
  if (file.size > TIMETABLE_IMAGE_REQUIREMENTS.maxByteSize) {
    throw new Error(
      `${TIMETABLE_IMAGE_REQUIREMENTS.maxSizeLabel} 이하 이미지를 올려주세요.`,
    );
  }

  const bytes = new Uint8Array(
    await file.slice(0, IMAGE_SIGNATURE_BYTE_LENGTH).arrayBuffer(),
  );
  const mimeType = detectImageMimeType(bytes);

  if (!mimeType) {
    throw new Error(
      `${TIMETABLE_IMAGE_REQUIREMENTS.supportedFormatLabel} 형식의 이미지를 올려주세요.`,
    );
  }

  const blob =
    file.type === mimeType
      ? file
      : new Blob([await file.arrayBuffer()], { type: mimeType });
  const bitmap = await decodeImage(blob);

  try {
    const { minWidth, minHeight } = TIMETABLE_IMAGE_REQUIREMENTS;
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
