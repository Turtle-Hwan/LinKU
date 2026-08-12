import { getLinkuDb, type StoredAsset } from "@/storage/linkuDb";

const MAX_ICON_BYTES = 5 * 1024 * 1024;
const MAX_ICON_DIMENSION = 256;

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
      0.9,
    );
  });
}

export async function normalizeIconBlob(source: Blob): Promise<Blob> {
  if (source.size > MAX_ICON_BYTES) {
    throw new Error("아이콘 원본은 5MB 이하여야 합니다.");
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
  const database = await getLinkuDb();
  const existing = await database.get("assets", id);
  if (existing) return existing;

  let numericId = Date.now();
  while (await database.getFromIndex("assets", "by-numeric-id", numericId)) {
    numericId += 1;
  }

  const asset: StoredAsset = {
    id,
    numericId,
    name,
    blob,
    dataUrl: await blobToDataUrl(blob),
    createdAt: Date.now(),
  };
  await database.put("assets", asset);
  return asset;
}

export async function listAssets(): Promise<StoredAsset[]> {
  const database = await getLinkuDb();
  const assets = await database.getAll("assets");
  return assets.sort((left, right) => right.createdAt - left.createdAt);
}

export async function renameAsset(id: string, name: string): Promise<StoredAsset> {
  const database = await getLinkuDb();
  const asset = await database.get("assets", id);
  if (!asset) throw new Error("아이콘을 찾을 수 없습니다.");
  const renamed = { ...asset, name };
  await database.put("assets", renamed);
  return renamed;
}

export async function deleteAsset(id: string): Promise<void> {
  const database = await getLinkuDb();
  await database.delete("assets", id);
}
