import assert from "node:assert/strict";
import test from "node:test";
import { normalizeStoredTemplate } from "../../src/storage/templateRecord.ts";

function record(template: unknown, extra: Record<string, unknown> = {}) {
  return { template, metadata: { lastSaved: 1_700_000_000_000 }, ...extra };
}

const healthyItem = {
  templateItemId: 1,
  name: "학사공지",
  siteUrl: "https://www.konkuk.ac.kr/",
  position: { x: 0, y: 0 },
  size: { width: 2, height: 1 },
  icon: { iconId: 3, iconName: "공지", iconUrl: "data:image/svg+xml,<svg/>" },
};

test("정상 레코드는 보정 없이 그대로 통과한다", () => {
  const result = normalizeStoredTemplate(
    record({
      templateId: 12,
      name: "내 템플릿",
      height: 6,
      cloned: false,
      items: [healthyItem],
      id: "5f0d0b6c-0000-4000-8000-000000000000",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    }),
  );

  assert.equal(result.repairs.length, 0);
  assert.ok(result.value);
  assert.equal(result.value.template.templateId, 12);
  assert.equal(result.value.template.items.length, 1);
  assert.equal(result.value.metadata.lastSaved, 1_700_000_000_000);
});

test("템플릿 객체나 항목 목록이 없으면 격리 대상으로 판정한다", () => {
  for (const broken of [
    null,
    "문자열",
    record(null),
    record({ templateId: 1, name: "x", height: 6 }),
  ]) {
    const result = normalizeStoredTemplate(broken);
    assert.equal(result.value, null);
    assert.ok(result.reason);
  }
});

test("식별자가 음수이거나 정수가 아니면 격리 대상으로 판정한다", () => {
  for (const templateId of [-1, 1.5, "3", Number.NaN]) {
    const result = normalizeStoredTemplate(
      record({ templateId, name: "x", height: 6, items: [] }),
    );
    assert.equal(result.value, null);
    assert.match(result.reason ?? "", /식별자/u);
  }
});

test("영역을 벗어난 항목은 버리지 않고 선언된 높이 안으로 보정한다", () => {
  const result = normalizeStoredTemplate(
    record({
      templateId: 7,
      name: "짧은 템플릿",
      height: 2,
      items: [
        { ...healthyItem, position: { x: 5, y: 5 }, size: { width: 4, height: 4 } },
      ],
    }),
  );

  assert.ok(result.value);
  const item = result.value.template.items[0];
  assert.ok(item.position.y + item.size.height <= 2);
  assert.ok(item.position.x + item.size.width <= 6);
  assert.equal(result.value.template.items.length, 1);
  assert.ok(result.repairs.some((note) => note.includes("보정")));
});

test("항목 식별자가 겹치면 새로 부여해 편집이 막히지 않게 한다", () => {
  const result = normalizeStoredTemplate(
    record({
      templateId: 8,
      name: "중복 식별자",
      height: 6,
      items: [healthyItem, { ...healthyItem, name: "도서관" }],
    }),
  );

  assert.ok(result.value);
  const ids = result.value.template.items.map((item) => item.templateItemId);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(result.repairs.some((note) => note.includes("식별자")));
});

test("이름이나 주소가 없는 항목만 제외하고 나머지는 지킨다", () => {
  const result = normalizeStoredTemplate(
    record({
      templateId: 9,
      name: "일부 손상",
      height: 6,
      items: [healthyItem, { ...healthyItem, siteUrl: "" }, "항목 아님"],
    }),
  );

  assert.ok(result.value);
  assert.equal(result.value.template.items.length, 1);
  assert.equal(result.repairs.length, 2);
});

test("이름과 높이가 비어 있거나 범위를 벗어나면 보정한다", () => {
  const result = normalizeStoredTemplate(
    record({ templateId: 10, name: "   ", height: 99, items: [] }),
  );

  assert.ok(result.value);
  assert.equal(result.value.template.name, "이름 없는 템플릿");
  assert.equal(result.value.template.height, 6);
  assert.equal(result.repairs.length, 2);
});

test("등록되지 않은 아이콘 식별자를 임의로 지어내지 않는다", () => {
  const result = normalizeStoredTemplate(
    record({
      templateId: 11,
      name: "가져온 템플릿",
      height: 6,
      items: [
        {
          ...healthyItem,
          icon: {
            iconId: -845_113,
            iconName: "내 아이콘",
            iconUrl: "data:image/png;base64,AAAA",
          },
        },
      ],
    }),
  );

  assert.ok(result.value);
  // 저장소 계층이 실제 asset을 등록해 양수 id를 부여한다. 여기서 숫자를
  // 지어내면 존재하지 않는 아이콘을 가리키는 레코드가 만들어진다.
  assert.equal(result.value.template.items[0].icon.iconId, -845_113);
});
