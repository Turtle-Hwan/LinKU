import assert from "node:assert/strict";
import test from "node:test";
import type { StoredAsset, StoredTemplate } from "../../src/storage/indexedDb/linkuDatabase.ts";
import type { TemplateIconRepairResult } from "../../src/storage/templates/iconRepair.ts";
import { createTemplateTestServer } from "./viteTestServer.ts";

function createStoredTemplate(): StoredTemplate {
  const now = "2026-08-24T00:00:00.000Z";
  return {
    template: {
      id: "11111111-1111-4111-8111-111111111111",
      templateId: 1,
      name: "아이콘 복구 테스트",
      height: 1,
      cloned: false,
      createdAt: now,
      updatedAt: now,
      syncStatus: "local",
      items: [
        {
          templateItemId: 1,
          name: "내 링크",
          siteUrl: "https://example.com/",
          position: { x: 0, y: 0 },
          size: { width: 1, height: 1 },
          icon: {
            iconId: 0,
            iconName: "내 아이콘",
            iconUrl: "data:image/png;base64,AAAA",
          },
        },
        {
          templateItemId: 2,
          name: "학교 홈페이지",
          siteUrl: "https://www.konkuk.ac.kr/",
          position: { x: 1, y: 0 },
          size: { width: 1, height: 1 },
          icon: {
            iconId: 1,
            iconName: "University",
            iconUrl: "data:image/svg+xml,stale",
          },
        },
      ],
    },
    stagingItems: [],
    metadata: { lastSaved: 1, savedLocally: true },
  };
}

test("다른 보정을 저장해도 등록에 실패한 inline icon 원본은 보존한다", async () => {
  const server = await createTemplateTestServer();

  try {
    const { repairTemplateIcons } = (await server.ssrLoadModule(
      "/src/storage/templates/iconRepair.ts",
    )) as {
      repairTemplateIcons: (
        stored: StoredTemplate,
        dependencies: {
          getAssetByNumericId: (id: number) => Promise<StoredAsset | undefined>;
          saveAssetFromDataUrl: (
            name: string,
            dataUrl: string,
          ) => Promise<StoredAsset>;
        },
      ) => Promise<TemplateIconRepairResult>;
    };
    const stored = createStoredTemplate();
    const originalIcon = stored.template.items[0].icon;
    const registrationError = new Error("IndexedDB unavailable");

    const result = await repairTemplateIcons(stored, {
      getAssetByNumericId: async () => undefined,
      saveAssetFromDataUrl: async () => {
        throw registrationError;
      },
    });

    assert.equal(result.changed, true);
    assert.notEqual(result.stored, stored);
    assert.equal(result.stored.template.items[0].icon, originalIcon);
    assert.notEqual(
      result.stored.template.items[1].icon.iconUrl,
      "data:image/svg+xml,stale",
    );
    assert.deepEqual(result.registrationFailures, [
      {
        area: "template",
        itemIndex: 0,
        itemName: "내 링크",
        error: registrationError,
      },
    ]);
  } finally {
    await server.close();
  }
});
