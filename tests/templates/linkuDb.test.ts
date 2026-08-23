import assert from "node:assert/strict";
import test from "node:test";
import "fake-indexeddb/auto";
import { getLinkuDb } from "../../src/storage/linkuDb.ts";

test("첫 배포용 v1 DB는 stateless store를 한 번에 만든다", async () => {
  const database = await getLinkuDb();

  assert.equal(database.version, 1);
  assert.deepEqual(Array.from(database.objectStoreNames).sort(), [
    "assets",
    "drafts",
    "migrations",
    "quarantine",
    "templates",
  ]);
  database.close();
});
