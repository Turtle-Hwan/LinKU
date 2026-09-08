import assert from "node:assert/strict";
import test from "node:test";
import "fake-indexeddb/auto";
import { createTemplateTestServer } from "./viteTestServer.ts";

test("읽기 중 보정·격리는 더 최신 편집을 덮거나 지우지 않는다", async () => {
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>(resolve => { started = resolve; });
  const barrier = new Promise<void>(resolve => { release = resolve; });
  Object.assign(globalThis, { templateReadTest: { started, barrier } });
  const server = await createTemplateTestServer([{
    name: "delayed-icon-repair",
    load(id) {
      if (id.endsWith("/src/storage/templates/iconRepair.ts")) return `
        export async function repairTemplateIcons(stored) {
          globalThis.templateReadTest.started();
          await globalThis.templateReadTest.barrier;
          return { stored, changed: true, registrationFailures: [] };
        }
      `;
    },
  }]);
  try {
    const { getLinkuDb } = await server.ssrLoadModule("/src/storage/indexedDb/linkuDatabase.ts") as typeof import("../../src/storage/indexedDb/linkuDatabase.ts");
    const repository = await server.ssrLoadModule("/src/storage/templates/repository.ts") as typeof import("../../src/storage/templates/repository.ts");
    const { moveRecordToQuarantineSafely } = await server.ssrLoadModule("/src/storage/templates/quarantine.ts") as typeof import("../../src/storage/templates/quarantine.ts");
    const db = await getLinkuDb();
    const now = new Date().toISOString();
    const initial = await repository.saveLocalTemplate({
      id: "11111111-1111-4111-8111-111111111111", templateId: 1,
      name: "before", height: 1, cloned: false, syncStatus: "local", items: [],
      createdAt: now, updatedAt: now,
    });
    const reading = repository.listLocalTemplates();
    await waiting;
    await repository.saveLocalTemplate({ ...initial.template, name: "latest" });
    const pending = await db.getAll("outbox");
    release();
    await reading;
    assert.equal((await db.get("templates", 1))?.template.name, "latest");
    assert.deepEqual(await db.getAll("outbox"), pending);

    assert.equal(await moveRecordToQuarantineSafely({ store: "templates", key: 1 }), false);
    assert.equal((await db.get("templates", 1))?.template.name, "latest");
    assert.equal(await db.count("quarantine"), 0);
  } finally {
    release();
    Reflect.deleteProperty(globalThis, "templateReadTest");
    await server.close();
  }
});
