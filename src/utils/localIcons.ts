import { deleteAsset, listAssets, renameAsset, saveAsset } from "@/storage/templates/assetRepository";
import { listLocalTemplates } from "@/storage/templates/repository";
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

function notifyIconChange(): void {
  window.dispatchEvent(new Event("linku:icons-changed"));
  window.dispatchEvent(new Event("linku:templates-changed"));
}

export async function renameLocalIcon(id: number, name: string): Promise<void> {
  await renameAsset(id, name);
  notifyIconChange();
}

export async function deleteLocalIcon(id: number): Promise<void> {
  await listLocalTemplates();
  await deleteAsset(id);
  notifyIconChange();
}
