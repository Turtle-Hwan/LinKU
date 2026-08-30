import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
} from "idb";
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
export type SyncResource = "asset" | "template";

export interface SyncOutboxEntry {
  key: string;
  generation: string;
  resource: SyncResource;
  resourceId: string;
  operation: SyncOperation;
  queuedAt: number;
  attempts: number;
}

export interface SyncMetadata {
  key: string;
  revision?: number;
  contentHash?: string;
  publicationRevision?: number;
  publishedContentHash?: string;
  isPublished?: boolean;
  lastSyncedAt?: number;
  lastError?: string;
}

export interface StoredSetting {
  key: string;
  value: unknown;
}

/** Where an active template record lives. */
export type RecordLocation = { store: "templates"; key: number };

/**
 * Quarantine also receives records copied from the legacy localStorage
 * migration. They have no IndexedDB key to remove, so their original storage
 * key is recorded separately from a live IndexedDB location.
 */
export type QuarantineLocation =
  | RecordLocation
  | { store: "legacy-local-storage"; key: string };

export const DRAFT_SLOT_KEY = "current";

/**
 * A record that failed read-time normalization.
 *
 * Local storage is the only copy of a user's templates, so an unreadable
 * record is never deleted on our own initiative. It is moved here with its
 * original bytes intact and reported to the user, who decides what happens
 * next.
 */
export interface QuarantinedRecord {
  id: string;
  at: QuarantineLocation;
  reason: string;
  quarantinedAt: number;
  raw: unknown;
}

export interface LinkuDatabase extends DBSchema {
  templates: {
    key: number;
    value: StoredTemplate;
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
    value: {
      completedAt: number;
      legacySources?: Record<
        string,
        { fingerprint: string; status: "migrated" | "quarantined" }
      >;
    };
  };
  quarantine: {
    key: string;
    value: QuarantinedRecord;
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

export type LinkuDb = IDBPDatabase<LinkuDatabase>;

const DATABASE_NAME = "linku";
// Version 4 is the shipped local-only schema. Version 5 adds account sync
// stores without rewriting or deleting any local record.
export const LINKU_DATABASE_VERSION = 5;

function openDatabase(
  databaseName: string,
  onConnectionClosed: () => void,
): Promise<LinkuDb> {
  const openingPromise = openDB<LinkuDatabase>(
    databaseName,
    LINKU_DATABASE_VERSION,
    {
      // Pre-release profiles contain different store subsets. Check each one
      // independently so the migration remains additive.
      upgrade(database, _oldVersion, _newVersion, transaction) {
        if (!database.objectStoreNames.contains("templates")) {
          database.createObjectStore("templates");
        }
        if (!database.objectStoreNames.contains("drafts")) {
          database.createObjectStore("drafts");
        }

        if (!database.objectStoreNames.contains("assets")) {
          const assets = database.createObjectStore("assets", {
            keyPath: "id",
          });
          assets.createIndex("by-numeric-id", "numericId", { unique: true });
        } else {
          const assets = transaction.objectStore("assets");
          if (!assets.indexNames.contains("by-numeric-id")) {
            assets.createIndex("by-numeric-id", "numericId", { unique: true });
          }
        }

        if (!database.objectStoreNames.contains("migrations")) {
          database.createObjectStore("migrations");
        }

        if (!database.objectStoreNames.contains("quarantine")) {
          database.createObjectStore("quarantine", { keyPath: "id" });
        }

        if (!database.objectStoreNames.contains("settings")) {
          database.createObjectStore("settings", { keyPath: "key" });
        }

        if (!database.objectStoreNames.contains("outbox")) {
          const outbox = database.createObjectStore("outbox", {
            keyPath: "key",
          });
          outbox.createIndex("by-queued-at", "queuedAt");
        } else {
          const outbox = transaction.objectStore("outbox");
          if (!outbox.indexNames.contains("by-queued-at")) {
            outbox.createIndex("by-queued-at", "queuedAt");
          }
        }

        if (!database.objectStoreNames.contains("syncMeta")) {
          database.createObjectStore("syncMeta", { keyPath: "key" });
        }
      },
      blocking() {
        // Popup, background and extension pages can each hold a connection.
        // Closing this version lets the next release upgrade the shared DB.
        void openingPromise.then((database) => {
          database.close();
          onConnectionClosed();
        });
      },
      terminated() {
        onConnectionClosed();
      },
    },
  );
  return openingPromise;
}

/** Opens an uncached database name for migration and compatibility tests. */
export function openLinkuDatabase(databaseName: string): Promise<LinkuDb> {
  return openDatabase(databaseName, () => {});
}

let databasePromise: Promise<LinkuDb> | undefined;

export function getLinkuDb(): Promise<LinkuDb> {
  if (!databasePromise) {
    const openingPromise = openDatabase(DATABASE_NAME, () => {
      if (databasePromise === openingPromise) {
        databasePromise = undefined;
      }
    });
    databasePromise = openingPromise;
    void openingPromise.catch(() => {
      if (databasePromise === openingPromise) {
        databasePromise = undefined;
      }
    });
  }

  return databasePromise;
}
