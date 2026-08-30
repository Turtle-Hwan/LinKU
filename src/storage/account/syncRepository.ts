import {
  getLinkuDb,
  type SyncMetadata,
  type SyncOutboxEntry,
  type SyncOperation,
  type SyncResource,
} from "../indexedDb/linkuDatabase.ts";
import type { AccountSyncStatus } from "../../types/account.ts";

const ACTIVE_ACCOUNT_KEY = "active-sync-account";

export class SyncAccountMismatchError extends Error {
  constructor() {
    super(
      "이 Chrome 프로필은 다른 Google 계정의 동기화 데이터와 연결되어 있습니다. 기존 계정으로 다시 로그인하거나 이 기기의 동기화 연결을 초기화한 뒤 전환해주세요.",
    );
    this.name = "SyncAccountMismatchError";
  }
}

export function createSyncOutboxEntry(
  resource: SyncResource,
  resourceId: string,
  operation: SyncOperation,
  queuedAt = Date.now(),
): SyncOutboxEntry {
  return {
    key: `${resource}:${resourceId}`,
    generation: crypto.randomUUID(),
    resource,
    resourceId,
    operation,
    queuedAt,
    attempts: 0,
  };
}

export function syncMetadataKey(
  accountId: string,
  resource: SyncResource,
  resourceId: string,
): string {
  return `${accountId}:${resource}:${resourceId}`;
}

export async function listSyncOutbox(): Promise<SyncOutboxEntry[]> {
  const database = await getLinkuDb();
  const entries = await database.getAllFromIndex("outbox", "by-queued-at");
  return entries.map((entry) => ({
    ...entry,
    generation:
      entry.generation ??
      `${entry.key}:${entry.queuedAt}:${entry.operation}`,
    resource: entry.resource ?? "template",
  }));
}

export async function isSyncOutboxEntryCurrent(
  expected: SyncOutboxEntry,
): Promise<boolean> {
  const database = await getLinkuDb();
  const current = await database.get("outbox", expected.key);
  return current ? isCurrentOperation(current, expected) : false;
}

function isCurrentOperation(
  current: SyncOutboxEntry,
  expected: SyncOutboxEntry,
): boolean {
  const currentGeneration =
    current.generation ??
    `${current.key}:${current.queuedAt}:${current.operation}`;
  return currentGeneration === expected.generation;
}

export async function removeSyncOutboxEntry(
  expected: SyncOutboxEntry,
): Promise<void> {
  const database = await getLinkuDb();
  const transaction = database.transaction("outbox", "readwrite");
  const store = transaction.objectStore("outbox");
  const current = await store.get(expected.key);
  if (current && isCurrentOperation(current, expected)) {
    await store.delete(expected.key);
  }
  await transaction.done;
}

export async function markSyncAttempt(
  expected: SyncOutboxEntry,
  metadataKey: string,
  message: string,
): Promise<void> {
  const database = await getLinkuDb();
  const transaction = database.transaction(["outbox", "syncMeta"], "readwrite");
  const outbox = transaction.objectStore("outbox");
  const current = await outbox.get(expected.key);
  if (current && isCurrentOperation(current, expected)) {
    await outbox.put({ ...current, attempts: current.attempts + 1 });
    const metadataStore = transaction.objectStore("syncMeta");
    const metadata = await metadataStore.get(metadataKey);
    await metadataStore.put({
      ...metadata,
      key: metadataKey,
      lastError: message,
    });
  }
  await transaction.done;
}

export async function getSyncMetadata(
  key: string,
): Promise<SyncMetadata | undefined> {
  const database = await getLinkuDb();
  return database.get("syncMeta", key);
}

export async function setSyncMetadata(metadata: SyncMetadata): Promise<void> {
  const database = await getLinkuDb();
  await database.put("syncMeta", metadata);
}

export interface PublicationMetadataState {
  templateId: string;
  revision: number;
  contentHash?: string;
  isPublished: boolean;
}

export async function replacePublicationMetadata(
  accountId: string,
  publications: PublicationMetadataState[],
): Promise<void> {
  const database = await getLinkuDb();
  const transaction = database.transaction("syncMeta", "readwrite");
  const store = transaction.objectStore("syncMeta");
  const prefix = `${accountId}:template:`;
  const metadataEntries = await store.getAll();
  const metadataByKey = new Map(
    metadataEntries.map((metadata) => [metadata.key, metadata]),
  );
  const publicationIds = new Set(
    publications.map((publication) => publication.templateId),
  );

  for (const publication of publications) {
    const key = `${prefix}${publication.templateId}`;
    await store.put({
      ...metadataByKey.get(key),
      key,
      publicationRevision: publication.revision,
      publishedContentHash: publication.contentHash,
      isPublished: publication.isPublished,
    });
  }

  for (const metadata of metadataEntries) {
    if (!metadata.key.startsWith(prefix)) continue;
    const templateId = metadata.key.slice(prefix.length);
    if (publicationIds.has(templateId)) continue;
    if (
      metadata.publicationRevision === undefined &&
      metadata.publishedContentHash === undefined &&
      metadata.isPublished === undefined
    ) {
      continue;
    }
    await store.put({
      ...metadata,
      publicationRevision: undefined,
      publishedContentHash: undefined,
      isPublished: false,
    });
  }
  await transaction.done;
}

export async function completeSyncOperation(
  expected: SyncOutboxEntry,
  metadata: SyncMetadata,
): Promise<void> {
  const database = await getLinkuDb();
  const transaction = database.transaction(["outbox", "syncMeta"], "readwrite");
  const outbox = transaction.objectStore("outbox");
  const current = await outbox.get(expected.key);
  if (current && isCurrentOperation(current, expected)) {
    await outbox.delete(expected.key);
  }
  await transaction.objectStore("syncMeta").put(metadata);
  await transaction.done;
}

export async function activateSyncAccount(accountId: string): Promise<boolean> {
  const database = await getLinkuDb();
  const current = await database.get("settings", ACTIVE_ACCOUNT_KEY);
  if (current?.value === accountId) return false;
  if (typeof current?.value === "string") {
    throw new SyncAccountMismatchError();
  }

  const transaction = database.transaction(
    ["assets", "templates", "settings", "outbox"],
    "readwrite",
  );
  const [assets, templates] = await Promise.all([
    transaction.objectStore("assets").getAll(),
    transaction.objectStore("templates").getAll(),
  ]);
  const outbox = transaction.objectStore("outbox");
  await outbox.clear();
  const queuedAt = Date.now();
  for (const stored of templates) {
    await outbox.put(
      createSyncOutboxEntry("template", stored.template.id, "put", queuedAt),
    );
  }
  for (const asset of assets) {
    await outbox.put(createSyncOutboxEntry("asset", asset.id, "put", queuedAt));
  }
  await transaction.objectStore("settings").put({
    key: ACTIVE_ACCOUNT_KEY,
    value: accountId,
  });
  await transaction.done;
  return true;
}

export async function clearCloudSyncState(): Promise<void> {
  const database = await getLinkuDb();
  const transaction = database.transaction(["outbox", "syncMeta"], "readwrite");
  await Promise.all([
    transaction.objectStore("outbox").clear(),
    transaction.objectStore("syncMeta").clear(),
  ]);
  await transaction.done;
}

export async function resetSyncConnection(): Promise<void> {
  const database = await getLinkuDb();
  const transaction = database.transaction(
    ["settings", "outbox", "syncMeta"],
    "readwrite",
  );
  await Promise.all([
    transaction.objectStore("settings").delete(ACTIVE_ACCOUNT_KEY),
    transaction.objectStore("outbox").clear(),
    transaction.objectStore("syncMeta").clear(),
  ]);
  await transaction.done;
}

export async function getActiveSyncAccountId(): Promise<string | null> {
  const database = await getLinkuDb();
  const account = await database.get("settings", ACTIVE_ACCOUNT_KEY);
  return typeof account?.value === "string" ? account.value : null;
}

export interface TemplateAccountState {
  status: AccountSyncStatus;
  isPublished: boolean;
  publishedContentHash?: string;
}

export async function getTemplateAccountStates(
  resourceIds: string[],
): Promise<Map<string, TemplateAccountState>> {
  if (resourceIds.length === 0) return new Map();
  const database = await getLinkuDb();
  const accountId = await getActiveSyncAccountId();
  if (!accountId) {
    return new Map(
      resourceIds.map((resourceId) => [
        resourceId,
        { status: "local", isPublished: false },
      ]),
    );
  }

  const [outboxEntries, metadataEntries] = await Promise.all([
    database.getAll("outbox"),
    database.getAll("syncMeta"),
  ]);
  const outbox = new Map(outboxEntries.map((entry) => [entry.key, entry]));
  const metadata = new Map(metadataEntries.map((entry) => [entry.key, entry]));

  return new Map(
    resourceIds.map((resourceId) => {
      const pending = outbox.get(`template:${resourceId}`);
      const current = metadata.get(
        syncMetadataKey(accountId, "template", resourceId),
      );
      const status: AccountSyncStatus =
        pending && pending.attempts > 0 && current?.lastError
          ? "error"
          : pending
            ? "pending"
            : current?.revision
              ? "synced"
              : "local";
      return [
        resourceId,
        {
          status,
          isPublished: current?.isPublished === true,
          publishedContentHash: current?.publishedContentHash,
        },
      ];
    }),
  );
}

export async function isTemplatePublished(resourceId: string): Promise<boolean> {
  const accountId = await getActiveSyncAccountId();
  if (!accountId) return false;
  const metadata = await getSyncMetadata(
    syncMetadataKey(accountId, "template", resourceId),
  );
  return metadata?.isPublished === true;
}
