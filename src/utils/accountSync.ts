import {
  deleteRemoteTemplate,
  downloadRemoteAsset,
  getRemoteTemplate,
  listRemoteAssets,
  listRemoteTemplates,
  putRemoteTemplate,
  uploadRemoteAsset,
} from "@/apis/supabase/templates";
import { SyncConflictError } from "@/apis/supabase/errors";
import { UserFacingError } from "@/errors/userFacingError";
import {
  completeSyncOperation,
  getActiveSyncAccountId,
  getSyncMetadata,
  isSyncOutboxEntryCurrent,
  listSyncOutbox,
  markSyncAttempt,
  removeSyncOutboxEntry,
  setSyncMetadata,
  syncMetadataKey,
} from "@/storage/account/syncRepository";
import {
  getAssetById,
  saveRemoteAsset,
} from "@/storage/templates/assetRepository";
import {
  importTemplateCopy,
  listLocalTemplates,
  removeLocalTemplateWithoutSync,
  saveRemoteTemplate,
} from "@/storage/templates/repository";
import type {
  StoredTemplate,
  SyncMetadata,
  SyncOutboxEntry,
} from "@/storage/indexedDb/linkuDatabase";
import type { RemoteTemplate } from "@/types/account";
import {
  cloudDocumentToTemplate,
  createCloudTemplateDocument,
  hashPublishedTemplate,
} from "@/sync/templateDocument";
import { isExpectedNetworkFailure } from "@/utils/networkFailure";
import { captureErrorLog } from "@/utils/logger";
import { recordBreadcrumb } from "@/monitoring";

export interface AccountSyncResult {
  synced: number;
  pulled: number;
  failed: number;
  conflicts: number;
  firstError?: string;
}

const emptyResult = (): AccountSyncResult => ({
  synced: 0,
  pulled: 0,
  failed: 0,
  conflicts: 0,
});

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "동기화를 완료하지 못했습니다.";
}

function isExpectedSyncFailure(error: unknown): boolean {
  return (
    error instanceof UserFacingError ||
    error instanceof SyncConflictError ||
    isExpectedNetworkFailure(error)
  );
}

function recordFailure(
  result: AccountSyncResult,
  error: unknown,
  resource: SyncOutboxEntry["resource"] | "pull",
  unexpectedAlreadyCaptured: boolean,
): boolean {
  result.failed += 1;
  result.firstError ??= errorMessage(error);
  recordBreadcrumb(
    "account.sync",
    "sync operation deferred",
    { resource, expected: isExpectedSyncFailure(error) },
    "warning",
  );
  if (!unexpectedAlreadyCaptured && !isExpectedSyncFailure(error)) {
    captureErrorLog("[Account sync] Unexpected operation failure", error, {
      resource,
    });
    return true;
  }
  return unexpectedAlreadyCaptured;
}

async function pullAssets(): Promise<void> {
  const remoteAssets = await listRemoteAssets();
  for (const remote of remoteAssets) {
    if (await getAssetById(remote.contentHash)) continue;
    const blob = await downloadRemoteAsset(remote);
    await saveRemoteAsset(remote.name, blob, remote.contentHash);
  }
}

async function pushAsset(
  entry: SyncOutboxEntry,
  accountId: string,
): Promise<void> {
  if (entry.operation === "delete") {
    await removeSyncOutboxEntry(entry);
    return;
  }
  const asset = await getAssetById(entry.resourceId);
  if (!asset) {
    await removeSyncOutboxEntry(entry);
    return;
  }
  const metadataKey = syncMetadataKey(accountId, "asset", entry.resourceId);
  const metadata = await getSyncMetadata(metadataKey);
  if (metadata?.contentHash === asset.id) {
    await removeSyncOutboxEntry(entry);
    return;
  }
  const remote = await uploadRemoteAsset(asset);
  await completeSyncOperation(entry, {
    key: metadataKey,
    contentHash: remote.contentHash,
    lastSyncedAt: Date.now(),
  });
}

async function applyRemoteTemplate(
  remote: RemoteTemplate,
  existingTemplateId?: number,
): Promise<void> {
  if (remote.deletedAt) {
    if (existingTemplateId !== undefined) {
      await removeLocalTemplateWithoutSync(existingTemplateId);
    }
    return;
  }
  const restored = await cloudDocumentToTemplate(remote.id, remote.document);
  await saveRemoteTemplate(
    restored.template,
    restored.stagingItems,
    existingTemplateId,
  );
}

async function resolveTemplateConflict(
  entry: SyncOutboxEntry,
  accountId: string,
  result: AccountSyncResult,
  localBySyncId: ReadonlyMap<string, StoredTemplate>,
): Promise<void> {
  const remote = await getRemoteTemplate(entry.resourceId);
  const operationIsCurrent = await isSyncOutboxEntryCurrent(entry);
  const local = operationIsCurrent
    ? (localBySyncId.get(entry.resourceId) ?? null)
    : null;

  if (operationIsCurrent && entry.operation === "put" && local) {
    await importTemplateCopy(local.template, local.stagingItems, {
      nameSuffix: "(충돌 복사본)",
    });
  }

  if (remote) {
    if (operationIsCurrent) {
      await applyRemoteTemplate(remote, local?.template.templateId);
    }
    await completeSyncOperation(entry, {
      key: syncMetadataKey(accountId, "template", entry.resourceId),
      revision: remote.revision,
      contentHash: remote.contentHash,
      lastSyncedAt: Date.now(),
    });
  } else {
    if (operationIsCurrent && local) {
      await removeLocalTemplateWithoutSync(local.template.templateId);
    }
    await removeSyncOutboxEntry(entry);
  }
  result.conflicts += 1;
}

async function restoreTemplateBlockedByPublication(
  entry: SyncOutboxEntry,
  accountId: string,
  metadata: SyncMetadata | undefined,
  result: AccountSyncResult,
  localBySyncId: ReadonlyMap<string, StoredTemplate>,
): Promise<boolean> {
  const remote = await getRemoteTemplate(entry.resourceId);
  if (!remote || remote.deletedAt) return false;

  if (await isSyncOutboxEntryCurrent(entry)) {
    const local = localBySyncId.get(entry.resourceId);
    await applyRemoteTemplate(remote, local?.template.templateId);
    result.pulled += 1;
  }
  await completeSyncOperation(entry, {
    ...metadata,
    key: syncMetadataKey(accountId, "template", entry.resourceId),
    revision: remote.revision,
    contentHash: remote.contentHash,
    isPublished: true,
    lastSyncedAt: Date.now(),
    lastError: undefined,
  });
  return true;
}

async function pushTemplate(
  entry: SyncOutboxEntry,
  accountId: string,
  result: AccountSyncResult,
  localBySyncId: ReadonlyMap<string, StoredTemplate>,
): Promise<void> {
  const metadataKey = syncMetadataKey(accountId, "template", entry.resourceId);
  const metadata = await getSyncMetadata(metadataKey);

  try {
    if (entry.operation === "delete") {
      if (!metadata?.revision) {
        await removeSyncOutboxEntry(entry);
        return;
      }
      const remote = await deleteRemoteTemplate(entry.resourceId, metadata.revision);
      await completeSyncOperation(entry, {
        ...metadata,
        key: metadataKey,
        revision: remote.revision,
        contentHash: remote.contentHash,
        lastSyncedAt: Date.now(),
        lastError: undefined,
      });
      result.synced += 1;
      return;
    }

    const local = localBySyncId.get(entry.resourceId);
    if (!local) {
      await removeSyncOutboxEntry(entry);
      return;
    }
    const document = await createCloudTemplateDocument(local);
    const contentHash = await hashPublishedTemplate(document);
    const remote = await putRemoteTemplate(
      entry.resourceId,
      document,
      contentHash,
      metadata?.revision,
    );
    await completeSyncOperation(entry, {
      ...metadata,
      key: metadataKey,
      revision: remote.revision,
      contentHash: remote.contentHash,
      lastSyncedAt: Date.now(),
      lastError: undefined,
    });
    result.synced += 1;
  } catch (error) {
    if (error instanceof SyncConflictError) {
      await resolveTemplateConflict(entry, accountId, result, localBySyncId);
      return;
    }
    if (
      entry.operation === "delete" &&
      error instanceof UserFacingError &&
      error.code === "PUBLICATION_ACTIVE" &&
      (await restoreTemplateBlockedByPublication(
        entry,
        accountId,
        metadata,
        result,
        localBySyncId,
      ))
    ) {
      return;
    }
    await markSyncAttempt(entry, metadataKey, errorMessage(error));
    throw error;
  }
}

async function pullTemplates(
  accountId: string,
  result: AccountSyncResult,
): Promise<void> {
  const [remoteTemplates, pending, localTemplates] = await Promise.all([
    listRemoteTemplates(),
    listSyncOutbox(),
    listLocalTemplates(),
  ]);
  const localBySyncId = new Map(
    localTemplates.map((stored) => [stored.template.id, stored]),
  );
  const pendingTemplates = new Set(
    pending
      .filter((entry) => entry.resource === "template")
      .map((entry) => entry.resourceId),
  );

  for (const remote of remoteTemplates) {
    if (pendingTemplates.has(remote.id)) continue;
    const metadataKey = syncMetadataKey(accountId, "template", remote.id);
    const metadata = await getSyncMetadata(metadataKey);
    if (metadata?.revision === remote.revision) continue;

    const local = localBySyncId.get(remote.id);
    await applyRemoteTemplate(remote, local?.template.templateId);
    const nextMetadata: SyncMetadata = {
      ...metadata,
      key: metadataKey,
      revision: remote.revision,
      contentHash: remote.contentHash,
      lastSyncedAt: Date.now(),
      lastError: undefined,
    };
    await setSyncMetadata(nextMetadata);
    result.pulled += 1;
  }
}

async function performSync(): Promise<AccountSyncResult> {
  const accountId = await getActiveSyncAccountId();
  if (!accountId) throw new UserFacingError("Google 로그인이 필요합니다.");

  const result = emptyResult();
  let capturedUnexpected = false;
  try {
    await pullAssets();
  } catch (error) {
    recordFailure(result, error, "pull", false);
    return result;
  }

  const [outbox, localTemplates] = await Promise.all([
    listSyncOutbox(),
    listLocalTemplates(),
  ]);
  const localBySyncId = new Map(
    localTemplates.map((stored) => [stored.template.id, stored]),
  );
  const ordered = [...outbox].sort((left, right) => {
    if (left.resource === right.resource) return left.queuedAt - right.queuedAt;
    return left.resource === "asset" ? -1 : 1;
  });
  for (const entry of ordered) {
    try {
      if (entry.resource === "asset") {
        await pushAsset(entry, accountId);
        result.synced += 1;
      } else {
        await pushTemplate(entry, accountId, result, localBySyncId);
      }
    } catch (error) {
      capturedUnexpected = recordFailure(
        result,
        error,
        entry.resource,
        capturedUnexpected,
      );
    }
  }

  try {
    await pullTemplates(accountId, result);
  } catch (error) {
    recordFailure(result, error, "pull", capturedUnexpected);
  }

  if (result.synced > 0 || result.pulled > 0 || result.conflicts > 0) {
    window.dispatchEvent(new Event("linku:templates-changed"));
  }
  return result;
}

let activeSync: Promise<AccountSyncResult> | null = null;

export function syncAccount(): Promise<AccountSyncResult> {
  if (!activeSync) {
    activeSync = performSync().finally(() => {
      activeSync = null;
    });
  }
  return activeSync;
}
