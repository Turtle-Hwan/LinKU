import assert from "node:assert/strict";
import test from "node:test";
import "fake-indexeddb/auto";
import { openDB, type IDBPDatabase } from "idb";
import { allocateTemplateId } from "../../src/storage/templateIds.ts";

// The production schema is re-declared here rather than imported so the test
// exercises the allocator against a plain store, without pulling the popup's
// module graph into a Node test run.
async function createDatabase(name: string): Promise<IDBPDatabase> {
  return openDB(name, 1, {
    upgrade(database) {
      database.createObjectStore("templates");
    },
  });
}

async function allocate(database: IDBPDatabase): Promise<number> {
  const transaction = database.transaction("templates", "readwrite");
  const store = transaction.objectStore("templates");
  const id = await allocateTemplateId(
    store as unknown as Parameters<typeof allocateTemplateId>[0],
  );
  await store.put({ marker: id }, id);
  await transaction.done;
  return id;
}

test("빈 저장소에서는 현재 시각 기준 식별자를 발급한다", async () => {
  const database = await createDatabase(`empty-${Date.now()}`);
  const before = Date.now();
  const id = await allocate(database);
  assert.ok(id >= before);
  database.close();
});

test("시계가 뒤로 가도 기존 템플릿을 덮어쓰지 않는다", async () => {
  const database = await createDatabase(`rollback-${Date.now()}`);

  // 미래 시각으로 저장된 템플릿 — 사용자가 시계를 되돌린 상황과 같다.
  const futureId = Date.now() + 60 * 60 * 1000;
  const transaction = database.transaction("templates", "readwrite");
  await transaction.objectStore("templates").put({ marker: "기존" }, futureId);
  await transaction.done;

  const allocated = await allocate(database);
  assert.ok(
    allocated > futureId,
    "발급된 식별자가 기존 템플릿을 덮어써서는 안 된다",
  );
  assert.deepEqual(await database.get("templates", futureId), {
    marker: "기존",
  });
  database.close();
});

test("연속 발급이 서로 겹치지 않는다", async () => {
  const database = await createDatabase(`sequence-${Date.now()}`);
  const ids: number[] = [];
  for (let index = 0; index < 5; index += 1) {
    ids.push(await allocate(database));
  }
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(await database.count("templates"), ids.length);
  database.close();
});
