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
}

const DATABASE_NAME = "linku";
const DATABASE_VERSION = 1;

let databasePromise: Promise<IDBPDatabase<LinkuDatabase>> | undefined;

export function getLinkuDb(): Promise<IDBPDatabase<LinkuDatabase>> {
  if (!databasePromise) {
    databasePromise = openDB<LinkuDatabase>(DATABASE_NAME, DATABASE_VERSION, {
      upgrade(database) {
        const templates = database.createObjectStore("templates");
        templates.createIndex("by-last-saved", "metadata.lastSaved");
        database.createObjectStore("drafts");

        const assets = database.createObjectStore("assets", { keyPath: "id" });
        assets.createIndex("by-numeric-id", "numericId", { unique: true });

        database.createObjectStore("migrations");
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
