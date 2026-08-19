import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeTemplateSharePayload,
  encodeTemplateSharePayload,
  validateTemplateSharePayload,
} from "../../src/utils/templateShareCodec.ts";
import type { TemplateSharePayloadV1 } from "../../src/types/templateShare.ts";

const payload: TemplateSharePayloadV1 = {
  version: 1,
  template: {
    name: "테스트 템플릿",
    height: 2,
    items: [
      {
        name: "건국대학교",
        siteUrl: "https://www.konkuk.ac.kr/",
        position: { x: 0, y: 0 },
        size: { width: 2, height: 1 },
        icon: { kind: "builtin", key: "University" },
      },
    ],
  },
};

test("템플릿 공유 payload를 URL fragment로 왕복한다", async () => {
  const fragment = await encodeTemplateSharePayload(payload);
  assert.match(fragment, /^v1\./u);
  assert.deepEqual(await decodeTemplateSharePayload(`#${fragment}`), payload);
});

test("위험한 URL scheme과 그리드 이탈을 거부한다", () => {
  const unsafeUrl = structuredClone(payload);
  unsafeUrl.template.items[0].siteUrl = "javascript:alert(1)";
  assert.throws(() => validateTemplateSharePayload(unsafeUrl), /HTTP/u);

  const outsideGrid = structuredClone(payload);
  outsideGrid.template.items[0].position.x = 5;
  outsideGrid.template.items[0].size.width = 2;
  assert.throws(() => validateTemplateSharePayload(outsideGrid), /영역/u);
});

test("실행 가능한 SVG data URL을 거부한다", () => {
  const svgIcon = structuredClone(payload);
  svgIcon.template.items[0].icon = {
    kind: "data",
    name: "unsafe",
    dataUrl: "data:image/svg+xml,<svg onload='alert(1)'/>",
  };
  assert.throws(() => validateTemplateSharePayload(svgIcon), /이미지 아이콘/u);
});

test("외부 추적이 가능한 remote icon 형식을 거부한다", () => {
  const remoteIcon = structuredClone(payload) as unknown as {
    template: { items: Array<{ icon: unknown }> };
  };
  remoteIcon.template.items[0].icon = {
    kind: "remote",
    name: "tracker",
    url: "https://tracker.example/icon.png",
  };
  assert.throws(() => validateTemplateSharePayload(remoteIcon), /아이콘/u);
});

test("손상된 압축 fragment를 사용자용 오류로 변환한다", async () => {
  await assert.rejects(
    decodeTemplateSharePayload("#v1.invalid"),
    /손상되었거나 지원되지 않습니다/u,
  );
});

test("선언된 높이보다 아래에 놓인 항목을 거부한다", () => {
  // 상수 6이 아니라 template.height로 검사해야 한다. height 1짜리 템플릿에
  // y:5 항목이 통과하면 미리보기에서 잘려 사라진 채로 저장된다.
  assert.throws(() =>
    validateTemplateSharePayload({
      version: 1,
      template: {
        name: "짧은 템플릿",
        height: 1,
        items: [
          {
            name: "도서관",
            siteUrl: "https://library.konkuk.ac.kr/",
            position: { x: 0, y: 5 },
            size: { width: 1, height: 1 },
            icon: { kind: "builtin", key: "Library" },
          },
        ],
      },
    }),
  );
});

test("선언된 높이 안에 들어가는 항목은 허용한다", () => {
  assert.doesNotThrow(() =>
    validateTemplateSharePayload({
      version: 1,
      template: {
        name: "짧은 템플릿",
        height: 2,
        items: [
          {
            name: "도서관",
            siteUrl: "https://library.konkuk.ac.kr/",
            position: { x: 0, y: 1 },
            size: { width: 1, height: 1 },
            icon: { kind: "builtin", key: "Library" },
          },
        ],
      },
    }),
  );
});
