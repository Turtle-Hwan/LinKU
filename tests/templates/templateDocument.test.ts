import assert from "node:assert/strict";
import test from "node:test";

import type { CloudTemplateDocumentV1 } from "../../src/types/account.ts";
import type { StoredTemplate } from "../../src/storage/indexedDb/linkuDatabase.ts";
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
    const emptyDocument = { ...document, items: [], stagingItems: [] };
    assert.deepEqual(module.parseCloudTemplateDocument(emptyDocument), emptyDocument);
    assert.deepEqual(module.parsePublishedTemplateSnapshot(module.createPublishedSnapshot(emptyDocument)), {
      version: 1, name: document.name, height: document.height, items: [],
    });
    assert.throws(() => module.parseCloudTemplateDocument({}));
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

    const withIcon = (name: string, hash = 'a'.repeat(64)): CloudTemplateDocumentV1 => ({
      ...document,
      items: [{ ...document.items[0], icon: { kind: 'asset', hash, name } }],
    });
    assert.equal(await module.hashPublishedTemplate(withIcon('이전 이름')),
      await module.hashPublishedTemplate(withIcon('새 이름')));
    assert.notEqual(await module.hashPublishedTemplate(withIcon('이름')),
      await module.hashPublishedTemplate(withIcon('이름', 'b'.repeat(64))));
    assert.deepEqual(module.createPublishedSnapshot(withIcon('이전 이름')).items[0].icon,
      { kind: 'asset', hash: 'a'.repeat(64), name: '이전 이름' });

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

test("재사용된 숫자 ID 대신 실제 이미지로 클라우드 아이콘을 찾는다", async () => {
  const server = await createTemplateTestServer([{
    name: "reused-asset-id",
    load(id) {
      if (id.endsWith("/src/storage/templates/assetRepository.ts")) return `
        export const getAssetById = async () => undefined;
        export const getAssetByNumericId = async () => ({
          id: '${'a'.repeat(64)}', name: '다른 이미지', dataUrl: 'data:image/webp;base64,b3RoZXI='
        });
        export const saveAssetFromDataUrl = async (name, dataUrl) => ({
          id: '${'b'.repeat(64)}', name, dataUrl
        });
      `;
    },
  }]);
  try {
    const module = await server.ssrLoadModule("/src/sync/templateDocument.ts") as typeof import("../../src/sync/templateDocument.ts");
    const stored: StoredTemplate = {
      template: {
        id: "local-template", templateId: 1, name: document.name, height: document.height,
        cloned: false, createdAt: document.createdAt, updatedAt: document.updatedAt,
        items: [{ ...document.items[0], icon: {
          iconId: 1234, iconName: "원본 이미지", iconUrl: "data:image/webp;base64,b3JpZ2luYWw=",
        } }],
      },
      stagingItems: [], metadata: { lastSaved: 1, savedLocally: true },
    };
    const result = await module.createCloudTemplateDocument(stored);
    assert.deepEqual(result.items[0].icon, { kind: "asset", hash: "b".repeat(64), name: "원본 이미지" });
  } finally {
    await server.close();
  }
});
