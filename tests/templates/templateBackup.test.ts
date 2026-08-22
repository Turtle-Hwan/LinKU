import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTemplateBackupSize,
  MAX_TEMPLATE_BACKUP_BYTES,
  parseTemplateBackup,
  prepareRestoredTemplate,
  type RestoredAssetReference,
} from "../../src/storage/templateBackup.ts";

const originalIconDataUrl = "data:image/png;base64,AAAA";

const storedRecord = {
  template: {
    templateId: 123,
    id: "11111111-1111-4111-8111-111111111111",
    name: "백업 템플릿",
    height: 2,
    cloned: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    syncStatus: "local" as const,
    items: [
      {
        templateItemId: 1,
        name: "도서관",
        siteUrl: "https://library.konkuk.ac.kr/",
        position: { x: 0, y: 0 },
        size: { width: 2, height: 1 },
        icon: {
          iconId: 4,
          iconName: "이전 아이콘",
          iconUrl: originalIconDataUrl,
        },
      },
    ],
  },
  stagingItems: [
    {
      templateItemId: 2,
      name: "임시 링크",
      siteUrl: "https://www.konkuk.ac.kr/",
      position: { x: 0, y: 1 },
      size: { width: 1, height: 1 },
      icon: {
        iconId: 4,
        iconName: "이전 아이콘",
        iconUrl: originalIconDataUrl,
      },
    },
  ],
  metadata: { lastSaved: 1_700_000_000_000, savedLocally: true as const },
};

test("백업 envelope와 아이콘을 저장소 작업 전에 검증한다", () => {
  const parsed = parseTemplateBackup({
    kind: "linku-backup",
    version: 1,
    exportedAt: "2026-08-21T00:00:00.000Z",
    templates: [storedRecord],
    assets: [{ name: "내 아이콘", dataUrl: originalIconDataUrl }],
  });

  assert.equal(parsed.templates.length, 1);
  assert.deepEqual(parsed.assets, [
    { name: "내 아이콘", dataUrl: originalIconDataUrl },
  ]);
});

test("잘못된 assets 구조와 실행 가능한 아이콘을 거부한다", () => {
  const base = {
    kind: "linku-backup",
    version: 1,
    exportedAt: "2026-08-21T00:00:00.000Z",
    templates: [],
  };

  assert.throws(() => parseTemplateBackup({ ...base, assets: null }), /백업/u);
  assert.throws(
    () =>
      parseTemplateBackup({
        ...base,
        assets: [
          {
            name: "실행 아이콘",
            dataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
          },
        ],
      }),
    /아이콘/u,
  );
  assert.throws(
    () =>
      parseTemplateBackup({
        ...base,
        assets: [{ name: "   ", dataUrl: originalIconDataUrl }],
      }),
    /아이콘/u,
  );
});

test("백업 아이콘 이름의 앞뒤 공백을 정리한다", () => {
  const parsed = parseTemplateBackup({
    kind: "linku-backup",
    version: 1,
    exportedAt: "2026-08-21T00:00:00.000Z",
    templates: [],
    assets: [{ name: "  내 아이콘  ", dataUrl: originalIconDataUrl }],
  });

  assert.equal(parsed.assets[0].name, "내 아이콘");
});

test("내보내기와 복원은 같은 10MB 크기 제한을 사용한다", () => {
  const base = {
    kind: "linku-backup" as const,
    version: 1 as const,
    exportedAt: "2026-08-21T00:00:00.000Z",
    assets: [],
  };

  assert.doesNotThrow(() =>
    assertTemplateBackupSize({ ...base, templates: [storedRecord] }),
  );

  const oversized = {
    ...base,
    templates: ["x".repeat(MAX_TEMPLATE_BACKUP_BYTES)],
  };
  assert.throws(() => assertTemplateBackupSize(oversized), /10MB/u);
  assert.throws(() => parseTemplateBackup(oversized), /10MB/u);
});

test("복원본은 두 식별자를 새로 만들고 아이콘을 실제 복원 id로 remap한다", () => {
  const restoredAsset: RestoredAssetReference = {
    numericId: 77,
    name: "복원 아이콘",
    dataUrl: "data:image/webp;base64,BBBB",
  };
  const restored = prepareRestoredTemplate(
    storedRecord,
    new Map([[originalIconDataUrl, restoredAsset]]),
  );

  assert.ok(restored);
  assert.equal(restored.template.templateId, 0);
  assert.notEqual(restored.template.id, storedRecord.template.id);
  assert.notEqual(restored.template.createdAt, storedRecord.template.createdAt);
  assert.equal(restored.template.items[0].icon.iconId, 77);
  assert.equal(restored.template.items[0].icon.iconUrl, restoredAsset.dataUrl);
  assert.equal(restored.stagingItems[0].icon.iconId, 77);
});

test("살릴 수 없는 템플릿 레코드는 복원 목록에서 건너뛴다", () => {
  assert.equal(
    prepareRestoredTemplate({ template: { templateId: 1 } }, new Map()),
    null,
  );
});
