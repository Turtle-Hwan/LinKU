import {
  getLinkuDb,
  type StoredAsset,
} from "@/storage/indexedDb/linkuDatabase";
import { allocateMonotonicId } from "@/storage/templates/monotonicId";
import { createSyncOutboxEntry } from "@/storage/account/syncRepository";
import {
  MAX_TEMPLATE_NAME_LENGTH,
  PORTABLE_ICON_PATTERN,
} from "@/constants/template";
import { InvalidTemplateBackupAssetError } from "@/storage/templates/backup";
import { UserFacingError } from "@/errors/userFacingError";

const MAX_ICON_BYTES = 5 * 1024 * 1024;
export const MAX_SYNCED_ICON_BYTES = 512 * 1024;
const MAX_ICON_DIMENSION = 256;
const ICON_WEBP_QUALITY = 0.9;
const RESTORABLE_ICON_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export class AssetValidationError extends UserFacingError {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message, "ASSET_VALIDATION_FAILED");
    this.name = "AssetValidationError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("파일을 읽지 못했습니다."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

async function canvasToWebp(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("아이콘 이미지를 변환하지 못했습니다."));
      },
      "image/webp",
      ICON_WEBP_QUALITY,
    );
  });
}

function normalizeAssetName(name: string): string {
  const normalizedName = name.trim();
  if (normalizedName.length === 0) {
    throw new AssetValidationError("아이콘 이름을 입력해 주세요.");
  }
  if (normalizedName.length > MAX_TEMPLATE_NAME_LENGTH) {
    throw new AssetValidationError(
      `아이콘 이름은 ${MAX_TEMPLATE_NAME_LENGTH}자 이하여야 합니다.`,
    );
  }
  return normalizedName;
}

function assertIconByteSize(source: Blob): void {
  if (source.size > MAX_ICON_BYTES) {
    throw new AssetValidationError(
      `아이콘 원본은 ${MAX_ICON_BYTES / 1024 / 1024}MB 이하여야 합니다.`,
    );
  }
}

async function withDecodedImage<T>(
  source: Blob,
  handleImage: (image: HTMLImageElement) => T | Promise<T>,
): Promise<T> {
  const objectUrl = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return await handleImage(image);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function normalizeIconBlob(source: Blob): Promise<Blob> {
  assertIconByteSize(source);

  try {
    return await withDecodedImage(source, async (image) => {
      const scale = Math.min(
        1,
        MAX_ICON_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("이미지 변환 기능을 사용할 수 없습니다.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await canvasToWebp(canvas);
    });
  } catch (error) {
    if (
      typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      (error.name === "EncodingError" || error.name === "InvalidStateError")
    ) {
      throw new AssetValidationError(
        "손상되었거나 브라우저에서 읽을 수 없는 아이콘입니다.",
        error,
      );
    }
    throw error;
  }
}

async function assertRestorableIconBlob(source: Blob): Promise<void> {
  if (source.size > MAX_SYNCED_ICON_BYTES) {
    throw new InvalidTemplateBackupAssetError(
      "백업 아이콘은 512KB 이하여야 합니다.",
    );
  }
  if (!RESTORABLE_ICON_TYPES.has(source.type)) {
    throw new InvalidTemplateBackupAssetError(
      "지원하지 않는 백업 아이콘 형식입니다.",
    );
  }

  try {
    await withDecodedImage(source, (image) => {
      if (
        image.naturalWidth > MAX_ICON_DIMENSION ||
        image.naturalHeight > MAX_ICON_DIMENSION
      ) {
        throw new InvalidTemplateBackupAssetError(
          `백업 아이콘은 ${MAX_ICON_DIMENSION}px 이하여야 합니다.`,
        );
      }
    });
  } catch (error) {
    if (
      typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "EncodingError"
    ) {
      throw new InvalidTemplateBackupAssetError();
    }
    throw error;
  }
}

async function persistAsset(
  normalizedName: string,
  blob: Blob,
  options: { expectedId?: string; queueSync?: boolean } = {},
): Promise<StoredAsset> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  const id = bytesToHex(new Uint8Array(digest));
  if (options.expectedId && options.expectedId !== id) {
    throw new AssetValidationError("아이콘 파일이 동기화 정보와 일치하지 않습니다.");
  }
  const dataUrl = await blobToDataUrl(blob);
  const createdAt = Date.now();
  const database = await getLinkuDb();
  const transaction = database.transaction(["assets", "outbox"], "readwrite");
  const store = transaction.objectStore("assets");
  const existing = await store.get(id);
  if (existing) {
    if (options.queueSync !== false) {
      await transaction
        .objectStore("outbox")
        .put(createSyncOutboxEntry("asset", id, "put"));
    }
    await transaction.done;
    return existing;
  }

  const numericId = await allocateMonotonicId(store.index("by-numeric-id"));

  const asset: StoredAsset = {
    id,
    numericId,
    name: normalizedName,
    blob,
    dataUrl,
    createdAt,
  };
  await store.put(asset);
  if (options.queueSync !== false) {
    await transaction
      .objectStore("outbox")
      .put(createSyncOutboxEntry("asset", id, "put"));
  }
  await transaction.done;
  return asset;
}

export async function saveAsset(name: string, source: Blob): Promise<StoredAsset> {
  const normalizedName = normalizeAssetName(name);
  const normalized = await normalizeIconBlob(source);
  if (normalized.size > MAX_SYNCED_ICON_BYTES) {
    throw new AssetValidationError("아이콘은 변환 후 512KB 이하여야 합니다.");
  }
  return persistAsset(normalizedName, normalized);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const separator = dataUrl.indexOf(",");
  const header = separator >= 0 ? dataUrl.slice(0, separator) : "";
  if (!header.startsWith("data:") || !header.endsWith(";base64")) {
    throw new Error("지원하지 않는 아이콘 이미지 형식입니다.");
  }
  const mimeType = header.slice("data:".length, header.length - ";base64".length);
  const binary = atob(dataUrl.slice(separator + 1));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

/** Registers an inline icon so imported templates remain editable. */
export async function saveAssetFromDataUrl(
  name: string,
  dataUrl: string,
): Promise<StoredAsset> {
  return saveAsset(name, dataUrlToBlob(dataUrl));
}

/** Restores validated WebP bytes without changing their content-addressed id. */
export async function restoreAssetFromDataUrl(
  name: string,
  dataUrl: string,
): Promise<StoredAsset> {
  const normalizedName = normalizeAssetName(name);
  if (!PORTABLE_ICON_PATTERN.test(dataUrl)) {
    throw new InvalidTemplateBackupAssetError(
      "백업 아이콘 데이터 형식이 올바르지 않습니다.",
    );
  }

  let blob: Blob;
  try {
    blob = dataUrlToBlob(dataUrl);
  } catch (error) {
    if (
      typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "InvalidCharacterError"
    ) {
      throw new InvalidTemplateBackupAssetError(
        "백업 아이콘 데이터 형식이 올바르지 않습니다.",
      );
    }
    throw error;
  }
  await assertRestorableIconBlob(blob);
  if (blob.type !== "image/webp") {
    return saveAsset(normalizedName, blob);
  }
  return persistAsset(normalizedName, blob);
}

export async function saveRemoteAsset(
  name: string,
  source: Blob,
  expectedId: string,
): Promise<StoredAsset> {
  const normalizedName = normalizeAssetName(name);
  if (source.type !== "image/webp" || source.size > MAX_SYNCED_ICON_BYTES) {
    throw new AssetValidationError("동기화한 아이콘 형식이 올바르지 않습니다.");
  }
  await assertRestorableIconBlob(source);
  return persistAsset(normalizedName, source, {
    expectedId,
    queueSync: false,
  });
}

export async function saveImportedCloudAsset(
  name: string,
  source: Blob,
  expectedId: string,
): Promise<StoredAsset> {
  const normalizedName = normalizeAssetName(name);
  if (source.type !== "image/webp" || source.size > MAX_SYNCED_ICON_BYTES) {
    throw new AssetValidationError("가져온 아이콘 형식이 올바르지 않습니다.");
  }
  await assertRestorableIconBlob(source);
  return persistAsset(normalizedName, source, { expectedId });
}

export async function getAssetById(id: string): Promise<StoredAsset | undefined> {
  const database = await getLinkuDb();
  return database.get("assets", id);
}

export async function getAssetByNumericId(
  numericId: number,
): Promise<StoredAsset | undefined> {
  const database = await getLinkuDb();
  return database.getFromIndex("assets", "by-numeric-id", numericId);
}

export async function listAssets(): Promise<StoredAsset[]> {
  const database = await getLinkuDb();
  const assets = await database.getAll("assets");
  return assets.sort((left, right) => right.createdAt - left.createdAt);
}
