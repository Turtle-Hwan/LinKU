import assert from "node:assert/strict";
import test from "node:test";
import "fake-indexeddb/auto";
import { deleteDB, openDB, type IDBPDatabase } from "idb";
import {
  LINKU_DATABASE_VERSION,
  openLinkuDatabase,
} from "../../src/storage/linkuDb.ts";

const expectedStores = [
  "assets",
  "drafts",
  "migrations",
  "quarantine",
  "templates",
];

function createPreReleaseStores(database: IDBPDatabase): void {
  database.createObjectStore("templates");
  database.createObjectStore("drafts");
  const assets = database.createObjectStore("assets", { keyPath: "id" });
  assets.createIndex("by-numeric-id", "numericId", { unique: true });
  database.createObjectStore("migrations");
  database.createObjectStore("outbox");
  database.createObjectStore("settings");
  database.createObjectStore("syncMeta");
}

test("새 DB는 현재 호환 버전과 stateless store를 한 번에 만든다", async () => {
  const databaseName = `linku-fresh-${Date.now()}-${Math.random()}`;
  const database = await openLinkuDatabase(databaseName);

  try {
    assert.equal(database.version, LINKU_DATABASE_VERSION);
    assert.deepEqual(
      Array.from(database.objectStoreNames).sort(),
      expectedStores,
    );
  } finally {
    database.close();
    await deleteDB(databaseName);
  }
});

for (const previousVersion of [2, 3]) {
  test(`일부 stateless store가 없는 version ${previousVersion} 프로필을 보존하며 보강한다`, async () => {
    const databaseName =
      `linku-existing-v${previousVersion}-${Date.now()}-${Math.random()}`;
    const existingDatabase = await openDB(databaseName, previousVersion, {
      upgrade(database) {
        createPreReleaseStores(database);
      },
    });
    const marker = { source: `existing-v${previousVersion}` };
    await existingDatabase.put("templates", marker, 42);
    existingDatabase.close();

    const database = await openLinkuDatabase(databaseName);
    try {
      assert.equal(database.version, LINKU_DATABASE_VERSION);
      assert.deepEqual(
        Array.from(database.objectStoreNames).sort(),
        [...expectedStores, "outbox", "settings", "syncMeta"].sort(),
      );
      assert.deepEqual(await database.get("templates", 42), marker);
    } finally {
      database.close();
      await deleteDB(databaseName);
    }
  });
}
