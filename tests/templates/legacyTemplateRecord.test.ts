import assert from "node:assert/strict";
import test from "node:test";
import {
  parseLegacyTemplateRecord,
} from "../../src/storage/templates/legacyRecord.ts";

function legacyRecord(templateId: number) {
  return {
    template: {
      templateId,
      id: "11111111-1111-4111-8111-111111111111",
      name: "레거시 템플릿",
      height: 1,
      cloned: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      items: [
        {
          templateItemId: 1,
          name: "도서관",
          siteUrl: "https://library.konkuk.ac.kr/",
          position: { x: 0, y: 0 },
          size: { width: 2, height: 1 },
          icon: {
            iconId: 42,
            iconName: "기존 사용자 아이콘",
            iconUrl: "https://cdn.example.com/user-icon.webp",
          },
        },
      ],
    },
    stagingItems: [],
    metadata: { lastSaved: 1_700_000_000_000, savedLocally: true },
  };
}

test("손상된 레거시 JSON은 throw하지 않고 quarantine 사유를 돌려준다", () => {
  const result = parseLegacyTemplateRecord("{broken");
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /JSON/u);
});

test("정규화할 수 없는 레거시 레코드는 migration 성공으로 취급하지 않는다", () => {
  const result = parseLegacyTemplateRecord(
    JSON.stringify({ template: { templateId: 3 } }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /항목 목록/u);
});

test("저장 템플릿의 0 식별자는 거부하고 draft에서만 허용한다", () => {
  const raw = JSON.stringify(legacyRecord(0));
  assert.equal(parseLegacyTemplateRecord(raw).ok, false);
  assert.equal(
    parseLegacyTemplateRecord(raw, { allowUnsavedTemplateId: true }).ok,
    true,
  );
});

test("기존 원격 아이콘 URL은 migration 입력에서 그대로 보존한다", () => {
  const result = parseLegacyTemplateRecord(JSON.stringify(legacyRecord(7)));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(
    result.stored.template.items[0].icon.iconUrl,
    "https://cdn.example.com/user-icon.webp",
  );
  assert.equal(result.stored.template.items[0].icon.iconId, 42);
});
