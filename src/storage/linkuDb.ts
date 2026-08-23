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
}

export type LinkuDb = IDBPDatabase<LinkuDatabase>;

const DATABASE_NAME = "linku";
// Version 2 builds were already loaded in unpacked/test profiles with the
// account-sync stores but without `quarantine`. Version 3 is an additive
// compatibility migration: it fills any missing stateless stores while
// retaining those pre-release stores and their data.
export const LINKU_DATABASE_VERSION = 3;

function openDatabase(
  databaseName: string,
  onConnectionClosed: () => void,
): Promise<LinkuDb> {
  const openingPromise = openDB<LinkuDatabase>(
    databaseName,
    LINKU_DATABASE_VERSION,
    {
      // Pre-release v2 profiles contain a different subset of stores. Check
      // each one independently so the migration is additive and never deletes
      // or recreates user data.
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
