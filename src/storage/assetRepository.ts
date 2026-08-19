import { getLinkuDb, type StoredAsset } from "@/storage/linkuDb";
import { allocateMonotonicId } from "@/storage/monotonicId";

const MAX_ICON_BYTES = 5 * 1024 * 1024;
const MAX_ICON_DIMENSION = 256;
const ICON_WEBP_QUALITY = 0.9;

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

export async function normalizeIconBlob(source: Blob): Promise<Blob> {
  if (source.size > MAX_ICON_BYTES) {
    throw new Error(
      `아이콘 원본은 ${MAX_ICON_BYTES / 1024 / 1024}MB 이하여야 합니다.`,
    );
  }

  const objectUrl = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();

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
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function saveAsset(name: string, source: Blob): Promise<StoredAsset> {
  const blob = await normalizeIconBlob(source);
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  const id = bytesToHex(new Uint8Array(digest));
  const dataUrl = await blobToDataUrl(blob);
  const createdAt = Date.now();
  const database = await getLinkuDb();
  const transaction = database.transaction("assets", "readwrite");
  const store = transaction.objectStore("assets");
  const existing = await store.get(id);
  if (existing) {
    await transaction.done;
    return existing;
  }

  const numericId = await allocateMonotonicId(store.index("by-numeric-id"));

  const asset: StoredAsset = {
    id,
    numericId,
    name,
    blob,
    dataUrl,
    createdAt,
  };
  await store.put(asset);
  await transaction.done;
  return asset;
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

/**
 * Registers an inline icon image so it becomes a first-class asset.
 *
 * Shared templates carry their icons as data URLs. Persisting them here is
 * what keeps an imported item editable: the editor resolves icons by numeric
 * id, and an id that no asset backs cannot be selected or saved again.
 */
export async function saveAssetFromDataUrl(
  name: string,
  dataUrl: string,
): Promise<StoredAsset> {
  return saveAsset(name, dataUrlToBlob(dataUrl));
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

export async function renameAsset(id: string, name: string): Promise<StoredAsset> {
  const database = await getLinkuDb();
  const transaction = database.transaction("assets", "readwrite");
  const store = transaction.objectStore("assets");
  const asset = await store.get(id);
  if (!asset) {
    transaction.abort();
    throw new Error("아이콘을 찾을 수 없습니다.");
  }
  const renamed = { ...asset, name };
  await store.put(renamed);
  await transaction.done;
  return renamed;
}

export async function deleteAsset(id: string): Promise<void> {
  const database = await getLinkuDb();
  await database.delete("assets", id);
}
