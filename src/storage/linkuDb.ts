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
    value: { completedAt: number };
  };
  quarantine: {
    key: string;
    value: QuarantinedRecord;
  };
}

export type LinkuDb = IDBPDatabase<LinkuDatabase>;

const DATABASE_NAME = "linku";
// This PR is the first release that creates `linku`, so every stateless store
// belongs to the initial v1 schema. The stacked account-sync PR must bump the
// version when it adds its own stores after this baseline ships.
const DATABASE_VERSION = 1;

let databasePromise: Promise<LinkuDb> | undefined;

export function getLinkuDb(): Promise<LinkuDb> {
  if (!databasePromise) {
    const openingPromise = openDB<LinkuDatabase>(DATABASE_NAME, DATABASE_VERSION, {
      // Every version step stays additive and guarded by `oldVersion`. An
      // unguarded `createObjectStore` throws once a user's profile already
      // holds an earlier version, and that failure is unrecoverable from our
      // side, so the guard exists from the first version onward.
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          database.createObjectStore("templates");
          database.createObjectStore("drafts");

          const assets = database.createObjectStore("assets", {
            keyPath: "id",
          });
          assets.createIndex("by-numeric-id", "numericId", { unique: true });

          database.createObjectStore("migrations");

          database.createObjectStore("quarantine", { keyPath: "id" });
        }
      },
      blocking() {
        // Popup, background and extension pages can each hold a connection.
        // Closing this version lets the next release upgrade the shared DB.
        void openingPromise.then((database) => {
          database.close();
          if (databasePromise === openingPromise) {
            databasePromise = undefined;
          }
        });
      },
      terminated() {
        if (databasePromise === openingPromise) {
          databasePromise = undefined;
        }
      },
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
