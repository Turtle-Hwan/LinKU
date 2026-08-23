import assert from "node:assert/strict";
import test from "node:test";
import {
  formatImportedTemplateName,
  normalizeStoredTemplate,
} from "../../src/storage/templateRecord.ts";

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

test("가져온 템플릿 이름은 접미사를 유지하며 최대 길이를 넘지 않는다", () => {
  const formatted = formatImportedTemplateName("가".repeat(80));
  assert.ok(formatted.endsWith(" (가져옴)"));
  assert.ok(formatted.length <= 80);
  assert.equal(formatImportedTemplateName(formatted), formatted);
});

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

test("저장 계약에 없는 임의 필드는 읽을 때 되살리지 않는다", () => {
  const result = normalizeStoredTemplate(
    record({
      templateId: 12,
      name: "내 템플릿",
      height: 6,
      cloned: false,
      items: [],
      id: "5f0d0b6c-0000-4000-8000-000000000000",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      accessToken: "보관되면 안 되는 값",
    }),
  );

  assert.ok(result.value);
  assert.equal("accessToken" in result.value.template, false);
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

test("저장 식별자가 0 이하이거나 정수가 아니면 격리 대상으로 판정한다", () => {
  for (const templateId of [-1, 0, 1.5, "3", Number.NaN]) {
    const result = normalizeStoredTemplate(
      record({ templateId, name: "x", height: 6, items: [] }),
    );
    assert.equal(result.value, null);
    assert.match(result.reason ?? "", /식별자/u);
  }
});

test("레거시 draft만 0 식별자를 명시적으로 허용한다", () => {
  const result = normalizeStoredTemplate(
    record({ templateId: 0, name: "이관 draft", height: 6, items: [] }),
    { allowUnsavedTemplateId: true },
  );
  assert.ok(result.value);
});

test("IndexedDB key와 내부 식별자가 다르면 격리 대상으로 판정한다", () => {
  const result = normalizeStoredTemplate(
    record({ templateId: 7, name: "엇갈린 템플릿", height: 6, items: [] }),
    { expectedTemplateId: 8 },
  );
  assert.equal(result.value, null);
  assert.match(result.reason ?? "", /식별자/u);
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

test("캔버스와 임시 저장 공간에서도 항목 식별자는 겹치지 않는다", () => {
  const result = normalizeStoredTemplate(
    record(
      {
        templateId: 16,
        name: "영역 간 중복 식별자",
        height: 6,
        items: [healthyItem],
      },
      {
        stagingItems: [
          { ...healthyItem, name: "임시 도서관" },
        ],
      },
    ),
  );

  assert.ok(result.value);
  const ids = [
    ...result.value.template.items,
    ...result.value.stagingItems,
  ].map((item) => item.templateItemId);
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
  assert.equal(
    result.repairs.filter((note) => note.includes("항목")).length,
    2,
  );
});

test("복원한 항목의 잘못된 주소와 위험한 스킴을 제외한다", () => {
  const result = normalizeStoredTemplate(
    record({
      templateId: 17,
      name: "주소가 손상된 백업",
      height: 6,
      items: [
        healthyItem,
        { ...healthyItem, name: "잘못된 주소", siteUrl: "not a url" },
        {
          ...healthyItem,
          name: "실행 스킴",
          siteUrl: "javascript:alert(1)",
        },
      ],
    }),
  );

  assert.ok(result.value);
  assert.deepEqual(
    result.value.template.items.map((item) => item.name),
    [healthyItem.name],
  );
  assert.equal(
    result.repairs.filter((note) => note.includes("주소")).length,
    2,
  );
});

test("이름과 높이가 비어 있거나 범위를 벗어나면 보정한다", () => {
  const result = normalizeStoredTemplate(
    record({ templateId: 10, name: "   ", height: 99, items: [] }),
  );

  assert.ok(result.value);
  assert.equal(result.value.template.name, "이름 없는 템플릿");
  assert.equal(result.value.template.height, 6);
  assert.ok(result.repairs.some((note) => note.includes("기본 이름")));
  assert.ok(result.repairs.some((note) => note.includes("높이")));
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

test("마지막 저장 시각이 없으면 보정으로 기록해 한 번만 다시 쓰이게 한다", () => {
  const result = normalizeStoredTemplate({
    template: { templateId: 13, name: "시각 없음", height: 6, items: [] },
  });

  assert.ok(result.value);
  assert.ok(Number.isFinite(result.value.metadata.lastSaved));
  // 보정으로 남지 않으면 저장소가 다시 쓰지 않아 읽을 때마다 시각이 바뀌고
  // 목록 정렬이 매번 흔들린다.
  assert.ok(result.repairs.some((note) => note.includes("저장 시각")));
});

test("고유 식별자와 생성·수정 시각을 한 번 복구해 영속화 대상으로 표시한다", () => {
  const first = normalizeStoredTemplate(
    record({ templateId: 15, name: "동기화 준비", height: 6, items: [] }),
  );

  assert.ok(first.value);
  assert.ok(first.value.template.id);
  assert.ok(first.value.template.createdAt);
  assert.ok(first.value.template.updatedAt);
  assert.ok(first.repairs.some((note) => note.includes("고유 식별자")));
  assert.ok(first.repairs.some((note) => note.includes("생성 시각")));
  assert.ok(first.repairs.some((note) => note.includes("수정 시각")));

  const second = normalizeStoredTemplate(first.value);
  assert.ok(second.value);
  assert.equal(second.repairs.length, 0);
  assert.equal(second.value.template.id, first.value.template.id);
  assert.equal(second.value.template.createdAt, first.value.template.createdAt);
  assert.equal(second.value.template.updatedAt, first.value.template.updatedAt);
});

test("보정은 두 번째 적용에서 더 이상 바뀌지 않는다", () => {
  const first = normalizeStoredTemplate({
    template: {
      templateId: 14,
      name: "",
      height: 99,
      items: [
        {
          name: "도서관",
          siteUrl: "https://library.konkuk.ac.kr/",
          position: { x: 9, y: 9 },
          size: { width: 9, height: 9 },
          icon: { iconId: 2, iconName: "책", iconUrl: "data:image/svg+xml,<svg/>" },
        },
      ],
    },
  });
  assert.ok(first.value);
  assert.ok(first.repairs.length > 0);

  const second = normalizeStoredTemplate(first.value);
  assert.ok(second.value);
  assert.equal(second.repairs.length, 0, "보정이 수렴하지 않으면 매 읽기마다 다시 쓴다");
  assert.deepEqual(second.value.template.items, first.value.template.items);
});
