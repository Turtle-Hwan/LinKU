import assert from "node:assert/strict";
import test from "node:test";
import "fake-indexeddb/auto";
import { createTemplateTestServer } from "./viteTestServer.ts";
import type { Template } from "../../src/types/api.ts";

const template: Template = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  templateId: 1,
  name: "local",
  height: 1,
  cloned: false,
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
  syncStatus: "local",
  items: [],
};

test("원격 적용은 최신 로컬 작업과 충돌 복사본을 트랜잭션으로 보존한다", async (t) => {
  const server = await createTemplateTestServer();
  try {
    const repository = await server.ssrLoadModule("/src/storage/templates/repository.ts") as typeof import("../../src/storage/templates/repository.ts");
    const sync = await server.ssrLoadModule("/src/storage/account/syncRepository.ts") as typeof import("../../src/storage/account/syncRepository.ts");
    const { getLinkuDb } = await server.ssrLoadModule("/src/storage/indexedDb/linkuDatabase.ts") as typeof import("../../src/storage/indexedDb/linkuDatabase.ts");
    const db = await getLinkuDb();
    const metadata = { key: `account:template:${template.id}`, revision: 2 };
    const record = { template: { ...template, name: "remote" }, stagingItems: [] };
    const prepare = async () => {
      for (const name of ["templates", "outbox", "syncMeta"] as const) await db.clear(name);
      await repository.saveLocalTemplate(template);
      return (await sync.listSyncOutbox())[0];
    };

    await t.test("조회 중 저장한 편집과 삭제를 원격본이 덮지 않는다", async () => {
      await prepare();
      const options = { resourceId: template.id, record, metadata };
      assert.equal(await repository.applyRemoteTemplateChange(options), false);
      assert.equal((await db.get("templates", 1))?.template.name, "local");
      assert.equal(await db.get("syncMeta", metadata.key), undefined);
      await repository.deleteLocalTemplate(1);
      assert.equal(await repository.applyRemoteTemplateChange(options), false);
      assert.equal(await db.get("templates", 1), undefined);
      assert.equal((await sync.listSyncOutbox())[0].operation, "delete");
    });

    await t.test("이전 충돌 응답은 더 최신 작업과 revision을 변경하지 않는다", async () => {
      const previous = await prepare();
      await repository.saveLocalTemplate({ ...template, name: "newest" });
      const current = (await sync.listSyncOutbox())[0];
      assert.equal(await repository.applyRemoteTemplateChange({
        resourceId: template.id, record, metadata,
        expectedOperation: previous, preserveLocal: true,
      }), false);
      assert.equal((await db.get("templates", 1))?.template.name, "newest");
      assert.equal(await db.count("templates"), 1);
      assert.deepEqual((await sync.listSyncOutbox())[0], current);
      assert.equal(await db.get("syncMeta", metadata.key), undefined);
    });

    await t.test("현재 충돌은 복사본·원격본·outbox·revision을 함께 반영한다", async () => {
      const entry = await prepare();
      assert.equal(await repository.applyRemoteTemplateChange({
        resourceId: template.id, record, metadata,
        expectedOperation: entry, preserveLocal: true,
      }), true);
      const records = await db.getAll("templates");
      assert.equal(records.length, 2);
      assert.equal((await db.get("templates", 1))?.template.name, "remote");
      const copy = records.find(value => value.template.id !== template.id)!;
      assert.match(copy.template.name, /충돌 복사본/u);
      assert.equal((await sync.listSyncOutbox())[0].resourceId, copy.template.id);
      assert.equal((await db.get("syncMeta", metadata.key))?.revision, 2);
    });

    await t.test("원격 삭제 충돌도 로컬본을 복사한 뒤 원본만 지운다", async () => {
      const entry = await prepare();
      await repository.applyRemoteTemplateChange({
        resourceId: template.id, record: null, metadata,
        expectedOperation: entry, preserveLocal: true,
      });
      assert.equal(await db.get("templates", 1), undefined);
      const copies = await db.getAll("templates");
      assert.equal(copies.length, 1);
      assert.match(copies[0].template.name, /충돌 복사본/u);
      assert.equal((await sync.listSyncOutbox())[0].resourceId, copies[0].template.id);
    });

    await t.test("충돌 복사 도중 실패하면 모든 IndexedDB 변경을 취소한다", async () => {
      const entry = await prepare();
      const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
        removeItem() { throw new Error("storage unavailable"); },
      } });
      try {
        await assert.rejects(repository.applyRemoteTemplateChange({
          resourceId: template.id, record: null, metadata,
          expectedOperation: entry, preserveLocal: true,
        }));
        assert.equal(await db.count("templates"), 1);
        assert.equal((await db.get("templates", 1))?.template.name, "local");
        assert.deepEqual((await sync.listSyncOutbox())[0], entry);
        assert.equal(await db.get("syncMeta", metadata.key), undefined);
      } finally {
        if (previous) Object.defineProperty(globalThis, "localStorage", previous);
        else Reflect.deleteProperty(globalThis, "localStorage");
      }
    });

    await t.test("중복 원격 적용은 UUID당 하나의 레코드와 최신 revision을 유지한다", async () => {
      await prepare();
      await db.clear("outbox");
      await db.clear("templates");
      const options = { resourceId: template.id, record, metadata };
      const applied = await Promise.all([
        repository.applyRemoteTemplateChange(options),
        repository.applyRemoteTemplateChange(options),
      ]);
      assert.deepEqual(applied.sort(), [false, true]);
      assert.equal(await db.count("templates"), 1);
      assert.equal(await repository.applyRemoteTemplateChange({
        ...options, metadata: { ...metadata, revision: 1 },
      }), false);
      assert.equal((await db.get("syncMeta", metadata.key))?.revision, 2);
    });
  } finally {
    await server.close();
  }
});
