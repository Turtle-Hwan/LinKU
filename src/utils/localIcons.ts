import { listAssets, saveAsset } from "@/storage/templates/assetRepository";
import type { StoredAsset } from "@/storage/indexedDb/linkuDatabase";
import type { Icon } from "@/types/api";

function toIcon(asset: StoredAsset): Icon {
  return {
    id: asset.numericId,
    name: asset.name,
    imageUrl: asset.dataUrl,
    isDefault: false,
    createdAt: new Date(asset.createdAt).toISOString(),
  };
}

export async function createLocalIcon(
  name: string,
  source: File | Blob,
): Promise<Icon> {
  return toIcon(await saveAsset(name, source));
}

export async function listLocalIcons(): Promise<Icon[]> {
  return (await listAssets()).map(toIcon);
}
