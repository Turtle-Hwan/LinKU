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
