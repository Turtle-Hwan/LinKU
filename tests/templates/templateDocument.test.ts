import assert from "node:assert/strict";
import test from "node:test";

import type { CloudTemplateDocumentV1 } from "../../src/types/account.ts";
import { createTemplateTestServer } from "./viteTestServer.ts";

const document: CloudTemplateDocumentV1 = {
  version: 1,
  name: "공부 템플릿",
  height: 2,
  cloned: false,
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z",
  items: [
    {
      templateItemId: 1,
      name: "링쿠",
      siteUrl: "https://linku.example/",
      position: { x: 0, y: 0 },
      size: { width: 2, height: 1 },
      icon: { kind: "builtin", key: "링크" },
    },
  ],
  stagingItems: [],
};

test("클라우드 문서와 게시 snapshot의 경계를 유지한다", async () => {
  const server = await createTemplateTestServer();

  try {
    const module = (await server.ssrLoadModule(
      "/src/sync/templateDocument.ts",
    )) as typeof import("../../src/sync/templateDocument.ts");

    assert.deepEqual(module.parseCloudTemplateDocument(document), document);
    assert.throws(() =>
      module.parseCloudTemplateDocument({
        ...document,
        items: [{ ...document.items[0], siteUrl: "javascript:alert(1)" }],
      }),
    );

    const originalHash = await module.hashPublishedTemplate(document);
    const editorOnlyChangeHash = await module.hashPublishedTemplate({
      ...document,
      cloned: true,
      updatedAt: "2026-08-31T01:00:00.000Z",
      stagingItems: document.items,
    });
    assert.equal(editorOnlyChangeHash, originalHash);
    assert.notEqual(
      await module.hashPublishedTemplate({ ...document, name: "수정된 이름" }),
      originalHash,
    );

    const cloned = await module.publishedSnapshotToTemplate(
      module.createPublishedSnapshot(document),
      async () => undefined,
    );
    assert.equal(cloned.cloned, true);
    assert.equal(cloned.name, document.name);
    assert.equal(cloned.items[0].icon.iconName, "링크");
  } finally {
    await server.close();
  }
});
