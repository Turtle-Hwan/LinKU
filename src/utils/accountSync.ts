import {
  deleteRemoteTemplate,
  getRemoteTemplate,
  listRemoteTemplates,
  putRemoteTemplate,
} from "@/apis/supabase/templates";
import { SyncConflictError } from "@/apis/supabase/errors";
import { requireSyncAccount } from "@/apis/supabase/account";
import { withAccountLock } from "@/utils/accountLock";
import { UserFacingError } from "@/errors/userFacingError";
import {
  completeSyncOperation,
  getSyncMetadata,
  isSyncOutboxEntryCurrent,
  listSyncOutbox,
  markSyncAttempt,
  removeSyncOutboxEntry,
  syncMetadataKey,
} from "@/storage/account/syncRepository";
import { compareSyncOperations, pullAssets, pushAsset } from "@/sync/assetSync";
import {
  applyRemoteTemplateChange,
  getPendingTemplate,
} from "@/storage/templates/repository";
import type {
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

async function applyRemoteTemplate(
  remote: RemoteTemplate | null,
  accountId: string,
  resourceId: string,
  options: {
    expectedOperation?: SyncOutboxEntry;
    preserveLocal?: boolean;
    isPublished?: boolean;
  } = {},
): Promise<boolean> {
  const record = remote && !remote.deletedAt
    ? await cloudDocumentToTemplate(remote.id, remote.document)
    : null;
  return applyRemoteTemplateChange({
    resourceId,
    record,
    expectedOperation: options.expectedOperation,
    preserveLocal: options.preserveLocal,
    metadata: {
      key: syncMetadataKey(accountId, "template", resourceId),
      revision: remote?.revision,
      contentHash: remote?.contentHash,
      lastError: undefined,
      ...(options.isPublished === undefined ? {} : { isPublished: options.isPublished }),
    },
  });
}

async function resolveTemplateConflict(
  entry: SyncOutboxEntry,
  accountId: string,
  result: AccountSyncResult,
): Promise<void> {
  const remote = await getRemoteTemplate(entry.resourceId);
  if (await applyRemoteTemplate(remote, accountId, entry.resourceId, {
    expectedOperation: entry,
    preserveLocal: true,
  })) {
    result.conflicts += 1;
  }
}

async function restoreTemplateBlockedByPublication(
  entry: SyncOutboxEntry,
  accountId: string,
  result: AccountSyncResult,
): Promise<boolean> {
  const remote = await getRemoteTemplate(entry.resourceId);
  if (!remote || remote.deletedAt) return false;

  if (await applyRemoteTemplate(remote, accountId, entry.resourceId, {
    expectedOperation: entry,
    isPublished: true,
  })) {
    result.pulled += 1;
  }
  return true;
}

async function pushTemplate(
  entry: SyncOutboxEntry,
  accountId: string,
  result: AccountSyncResult,
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
        lastError: undefined,
      });
      result.synced += 1;
      return;
    }

    const local = await getPendingTemplate(entry);
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
      lastError: undefined,
    });
    result.synced += 1;
  } catch (error) {
    if (error instanceof SyncConflictError) {
      await resolveTemplateConflict(entry, accountId, result);
      return;
    }
    if (
      entry.operation === "delete" &&
      error instanceof UserFacingError &&
      error.code === "PUBLICATION_ACTIVE" &&
      (await restoreTemplateBlockedByPublication(
        entry,
        accountId,
        result,
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
  const remoteTemplates = await listRemoteTemplates();
  for (const remote of remoteTemplates) {
    const metadataKey = syncMetadataKey(accountId, "template", remote.id);
    const metadata = await getSyncMetadata(metadataKey);
    if (metadata?.revision === remote.revision) continue;

    if (await applyRemoteTemplate(remote, accountId, remote.id)) {
      result.pulled += 1;
    }
  }
}

async function performSync(): Promise<AccountSyncResult> {
  const accountId = await requireSyncAccount();

  const result = emptyResult();
  let capturedUnexpected = false;
  try {
    result.pulled += await pullAssets(accountId);
  } catch (error) {
    recordFailure(result, error, "pull", false);
    return result;
  }

  const outbox = await listSyncOutbox();
  const ordered = [...outbox].sort(compareSyncOperations);
  for (const entry of ordered) {
    try {
      if (!(await isSyncOutboxEntryCurrent(entry))) continue;
      if (entry.resource === "asset") {
        const assetResult = await pushAsset(entry, accountId);
        if (assetResult.conflict) result.conflicts += 1;
        else result.synced += 1;
        if (assetResult.blocked) {
          result.failed += 1;
          result.firstError ??= assetResult.blocked;
        }
      } else {
        await pushTemplate(entry, accountId, result);
      }
    } catch (error) {
      if (entry.resource === "asset") {
        await markSyncAttempt(entry, syncMetadataKey(accountId, "asset", entry.resourceId), errorMessage(error));
      }
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
    window.dispatchEvent(new Event("linku:icons-changed"));
  }
  return result;
}

let activeSync: Promise<AccountSyncResult> | null = null;
let syncRequested = false;

export function syncAccount(): Promise<AccountSyncResult> {
  syncRequested = true;
  if (!activeSync) {
    activeSync = withAccountLock(async () => {
      const total = emptyResult();
      do {
        syncRequested = false;
        const result = await performSync();
        total.synced += result.synced;
        total.pulled += result.pulled;
        total.failed += result.failed;
        total.conflicts += result.conflicts;
        total.firstError ??= result.firstError;
      } while (syncRequested && total.failed === 0);
      return total;
    }).finally(() => {
      activeSync = null;
    });
  }
  return activeSync;
}
