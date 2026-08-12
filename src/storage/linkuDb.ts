import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Template, TemplateItem } from "@/types/api";

export interface StoredTemplate {
  template: Template;
  stagingItems: TemplateItem[];
  metadata: {
    lastSaved: number;
    savedLocally: true;
  };
}

export interface StoredAsset {
  id: string;
  numericId: number;
  name: string;
  blob: Blob;
  dataUrl: string;
  createdAt: number;
}

export type SyncOperation = "put" | "delete";

export interface SyncOutboxEntry {
  key: string;
  resourceId: string;
  operation: SyncOperation;
  queuedAt: number;
  attempts: number;
}

export interface SyncMetadata {
  key: string;
  etag?: string;
  lastSyncedAt?: number;
  lastError?: string;
}

interface StoredSetting {
  key: string;
  value: unknown;
}

interface LinkuDatabase extends DBSchema {
  templates: {
    key: number;
    value: StoredTemplate;
    indexes: { "by-last-saved": number };
  };
  drafts: {
    key: "current";
    value: StoredTemplate;
  };
  assets: {
    key: string;
    value: StoredAsset;
    indexes: { "by-numeric-id": number };
  };
  migrations: {
    key: string;
    value: { completedAt: number };
  };
  settings: {
    key: string;
    value: StoredSetting;
  };
  outbox: {
    key: string;
    value: SyncOutboxEntry;
    indexes: { "by-queued-at": number };
  };
  syncMeta: {
    key: string;
    value: SyncMetadata;
  };
}

const DATABASE_NAME = "linku";
const DATABASE_VERSION = 2;
const ACTIVE_ACCOUNT_KEY = "active-sync-account";

let databasePromise: Promise<IDBPDatabase<LinkuDatabase>> | undefined;

export class SyncAccountMismatchError extends Error {
  constructor() {
    super(
      "이 Chrome 프로필은 다른 Google 계정의 동기화 데이터와 연결되어 있습니다. 기존 계정으로 다시 로그인하거나 계정 데이터를 삭제한 뒤 전환해주세요.",
    );
    this.name = "SyncAccountMismatchError";
  }
}

export function getLinkuDb(): Promise<IDBPDatabase<LinkuDatabase>> {
  if (!databasePromise) {
    databasePromise = openDB<LinkuDatabase>(DATABASE_NAME, DATABASE_VERSION, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          const templates = database.createObjectStore("templates");
          templates.createIndex("by-last-saved", "metadata.lastSaved");
          database.createObjectStore("drafts");

          const assets = database.createObjectStore("assets", { keyPath: "id" });
          assets.createIndex("by-numeric-id", "numericId", { unique: true });

          database.createObjectStore("migrations");
        }

        if (oldVersion < 2) {
          database.createObjectStore("settings", { keyPath: "key" });
          const outbox = database.createObjectStore("outbox", { keyPath: "key" });
          outbox.createIndex("by-queued-at", "queuedAt");
          database.createObjectStore("syncMeta", { keyPath: "key" });
        }
      },
      blocked() {
        databasePromise = undefined;
      },
      terminated() {
        databasePromise = undefined;
      },
    });
    void databasePromise.catch(() => {
      databasePromise = undefined;
    });
  }

  return databasePromise;
}

export async function listSyncOutbox(): Promise<SyncOutboxEntry[]> {
  const database = await getLinkuDb();
  return database.getAllFromIndex("outbox", "by-queued-at");
}

export async function removeSyncOutboxEntry(key: string): Promise<void> {
  const database = await getLinkuDb();
  await database.delete("outbox", key);
}

export async function markSyncAttempt(
  outboxKey: string,
  metadataKey: string,
  message: string,
): Promise<void> {
  const database = await getLinkuDb();
  const transaction = database.transaction(["outbox", "syncMeta"], "readwrite");
  const outbox = transaction.objectStore("outbox");
  const current = await outbox.get(outboxKey);
  if (current) {
    await outbox.put({ ...current, attempts: current.attempts + 1 });
  }
  const metadata = await transaction.objectStore("syncMeta").get(metadataKey);
  await transaction.objectStore("syncMeta").put({
    ...metadata,
    key: metadataKey,
    lastError: message,
  });
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

export async function activateSyncAccount(accountId: string): Promise<boolean> {
  const database = await getLinkuDb();
  const current = await database.get("settings", ACTIVE_ACCOUNT_KEY);
  if (current?.value === accountId) return false;
  if (typeof current?.value === "string") {
    throw new SyncAccountMismatchError();
  }

  const transaction = database.transaction(
    ["templates", "settings", "outbox"],
    "readwrite",
  );
  const templates = await transaction.objectStore("templates").getAll();
  await transaction.objectStore("outbox").clear();
  const queuedAt = Date.now();
  for (const stored of templates) {
    const resourceId = stored.template.id;
    await transaction.objectStore("outbox").put({
      key: `template:${resourceId}`,
      resourceId,
      operation: "put",
      queuedAt,
      attempts: 0,
    });
  }
  await transaction.objectStore("settings").put({
    key: ACTIVE_ACCOUNT_KEY,
    value: accountId,
  });
  await transaction.done;
  return true;
}

export async function clearAccountSyncState(): Promise<void> {
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

export async function getTemplateSyncState(
  resourceId: string,
): Promise<"local" | "pending" | "synced" | "error"> {
  const database = await getLinkuDb();
  const outboxKey = `template:${resourceId}`;
  const account = await database.get("settings", ACTIVE_ACCOUNT_KEY);
  const accountId = typeof account?.value === "string" ? account.value : null;
  if (!accountId) return "local";
  const metadataKey = `${accountId}:template:${resourceId}`;
  const [pending, metadata] = await Promise.all([
    database.get("outbox", outboxKey),
    database.get("syncMeta", metadataKey),
  ]);
  if (pending && metadata?.lastError) return "error";
  if (pending) return "pending";
  return metadata?.etag ? "synced" : "local";
}
