import {
  deleteRemoteAsset,
  downloadRemoteAsset,
  getRemoteAsset,
  listRemoteAssets,
  putRemoteAsset,
  uploadRemoteAsset,
} from "@/apis/supabase/templates";
import { SyncConflictError } from "@/apis/supabase/errors";
import { UserFacingError } from "@/errors/userFacingError";
import {
  completeSyncOperation,
  getSyncMetadata,
  removeSyncOutboxEntry,
  syncMetadataKey,
} from "@/storage/account/syncRepository";
import { getLinkuDb, type SyncOutboxEntry } from "@/storage/indexedDb/linkuDatabase";
import { applyRemoteAssetChange, getAssetById, saveRemoteAsset } from "@/storage/templates/assetRepository";

export async function pullAssets(accountId: string): Promise<number> {
  const remoteAssets = await listRemoteAssets();
  let changed = 0;
  for (const remote of remoteAssets) {
    const existing = await getAssetById(remote.contentHash);
    if (!existing) {
      const blob = await downloadRemoteAsset(remote);
      await saveRemoteAsset(remote.name, blob, remote.contentHash);
    }
    if (await applyRemoteAssetChange(remote.contentHash, remote,
      syncMetadataKey(accountId, "asset", remote.contentHash))) changed += 1;
  }

  const database = await getLinkuDb();
  const remoteIds = new Set(remoteAssets.map((asset) => asset.contentHash));
  const prefix = `${accountId}:asset:`;
  for (const metadata of await database.getAll("syncMeta")) {
    if (!metadata.key.startsWith(prefix)) continue;
    const id = metadata.key.slice(prefix.length);
    if (!remoteIds.has(id) && await applyRemoteAssetChange(id, null, metadata.key)) changed += 1;
  }
  return changed;
}

/** Asset puts precede templates; deletes follow them so removed references commit first. */
export function compareSyncOperations(left: SyncOutboxEntry, right: SyncOutboxEntry): number {
  const priority = (entry: SyncOutboxEntry) => entry.resource === "template" ? 1 : entry.operation === "delete" ? 2 : 0;
  return priority(left) - priority(right) || left.queuedAt - right.queuedAt;
}

export async function pushAsset(entry: SyncOutboxEntry, accountId: string): Promise<{ conflict: boolean; blocked?: string }> {
  const key = syncMetadataKey(accountId, "asset", entry.resourceId);
  const metadata = await getSyncMetadata(key);
  try {
    if (entry.operation === "delete") {
      if (metadata?.revision) {
        await deleteRemoteAsset(entry.resourceId, metadata.revision);
      } else if (await getRemoteAsset(entry.resourceId)) {
        throw new SyncConflictError();
      }
      await completeSyncOperation(entry, { ...metadata, key, contentHash: entry.resourceId, deleted: true, lastError: undefined });
      await applyRemoteAssetChange(entry.resourceId, null, key);
      return { conflict: false };
    }
    const asset = await getAssetById(entry.resourceId);
    if (!asset || asset.deletedAt) {
      await removeSyncOutboxEntry(entry);
      return { conflict: false };
    }
    const remote = metadata?.revision && !metadata.deleted
      ? await putRemoteAsset(asset.id, asset.name, metadata.revision)
      : await uploadRemoteAsset(asset);
    await completeSyncOperation(entry, { key, contentHash: asset.id, revision: remote.revision, deleted: false });
    await applyRemoteAssetChange(asset.id, remote, key);
    return { conflict: false };
  } catch (error) {
    const blocked = entry.operation === "delete" && error instanceof UserFacingError && error.code === "ASSET_IN_USE";
    if (!(error instanceof SyncConflictError) && !blocked) throw error;
    const remote = await getRemoteAsset(entry.resourceId);
    const applied = await applyRemoteAssetChange(entry.resourceId, remote, key, entry);
    return { conflict: applied, blocked: applied && blocked ? error.message : undefined };
  }
}
