import assert from "node:assert/strict";
import test from "node:test";
import "fake-indexeddb/auto";
import { getLinkuDb } from "../../src/storage/linkuDb.ts";
import {
  LEGACY_MIGRATION_KEY,
  LEGACY_TEMPLATE_PREFIX,
  migrateLegacyTemplateStorage,
} from "../../src/storage/legacyTemplateMigration.ts";

class MemoryStorage {
  readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function legacyRecord(templateId: number, name: string, lastSaved: number) {
  const timestamp = new Date(lastSaved).toISOString();
  return JSON.stringify({
    template: {
      templateId,
      id: crypto.randomUUID(),
      name,
      height: 1,
      cloned: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      items: [],
    },
    stagingItems: [],
    metadata: { lastSaved, savedLocally: true },
  });
}

const databasePromise = getLinkuDb();

test("완료 후에도 변경되거나 새로 생긴 레거시 템플릿을 다시 이관한다", async () => {
  const database = await databasePromise;
  const storage = new MemoryStorage();
  const firstKey = `${LEGACY_TEMPLATE_PREFIX}101`;
  const brokenKey = `${LEGACY_TEMPLATE_PREFIX}303`;
  const conflictKey = `${LEGACY_TEMPLATE_PREFIX}404`;
  storage.setItem(firstKey, legacyRecord(101, "최초 이관", 1_000));
  storage.setItem(brokenKey, "{broken");
  storage.setItem(conflictKey, legacyRecord(404, "레거시 충돌", 1_000));
  await database.put(
    "templates",
    JSON.parse(legacyRecord(404, "IndexedDB 원본", 5_000)),
    404,
  );

  const first = await migrateLegacyTemplateStorage(database, storage);
  assert.equal((await database.get("templates", 101))?.template.name, "최초 이관");
  assert.equal(first.quarantined.length, 2);
  assert.equal(await database.count("quarantine"), 2);

  const unchanged = await migrateLegacyTemplateStorage(database, storage);
  assert.equal(unchanged.quarantined.length, 0);
  assert.equal(await database.count("quarantine"), 2);

  storage.setItem(firstKey, legacyRecord(101, "롤백에서 수정", 2_000));
  storage.setItem(
    `${LEGACY_TEMPLATE_PREFIX}202`,
    legacyRecord(202, "롤백에서 생성", 2_000),
  );
  storage.setItem(conflictKey, legacyRecord(404, "격리 원본 수정", 6_000));
  const rollback = await migrateLegacyTemplateStorage(database, storage);

  assert.equal(
    (await database.get("templates", 101))?.template.name,
    "롤백에서 수정",
  );
  assert.equal(
    (await database.get("templates", 202))?.template.name,
    "롤백에서 생성",
  );
  assert.equal(
    (await database.get("templates", 404))?.template.name,
    "IndexedDB 원본",
  );
  assert.equal(
    rollback.quarantined.some((entry) => entry.key === conflictKey),
    true,
  );
  const marker = await database.get("migrations", LEGACY_MIGRATION_KEY);
  assert.deepEqual(
    Object.keys(marker?.legacySources ?? {}).sort(),
    [brokenKey, conflictKey, firstKey, `${LEGACY_TEMPLATE_PREFIX}202`].sort(),
  );

  await database.put(
    "migrations",
    { completedAt: 1 },
    LEGACY_MIGRATION_KEY,
  );
  storage.setItem(firstKey, legacyRecord(101, "이전 마커 이후 수정", 3_000));
  await migrateLegacyTemplateStorage(database, storage);
  assert.equal(
    (await database.get("templates", 101))?.template.name,
    "이전 마커 이후 수정",
  );
});

test("레거시 저장소를 읽지 못하면 이관 실패를 전파한다", async (context) => {
  const database = await databasePromise;
  context.after(() => database.close());
  const inaccessibleStorage = {
    get length(): number {
      throw new Error("legacy storage blocked");
    },
    key: () => null,
    getItem: () => null,
  };

  await assert.rejects(
    migrateLegacyTemplateStorage(database, inaccessibleStorage),
    /legacy storage blocked/u,
  );
});
