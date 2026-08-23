import assert from "node:assert/strict";
import test from "node:test";

import type { Icon } from "../../src/types/api.ts";
import { matchTemplateIcon } from "../../src/utils/templateIconMatch.ts";

const icons: Icon[] = [
  "University",
  "BellRing",
  "eCampus",
  "Trophy",
  "Clock",
  "MapPinned",
  "GraduationCap",
  "BookCopy",
  "CalendarDays",
  "Utensils",
  "에브리타임",
  "UsersRound",
  "Bed",
  "MessageCircleMore",
  "ScrollText",
  "Building",
  "Lightbulb",
  "링크",
].map((name, index) => ({
  id: index + 1,
  name,
  imageUrl: `data:image/png;base64,${index}`,
  isDefault: true,
}));

const expectedNamesByLabel: Record<string, string> = {
  홈페이지: "University",
  공지사항: "BellRing",
  eCampus: "eCampus",
  위인전: "Trophy",
  수강신청: "Clock",
  캠퍼스맵: "MapPinned",
  학사정보시스템: "GraduationCap",
  상허기념도서관: "BookCopy",
  학사일정: "CalendarDays",
  "학식 메뉴": "Utensils",
  에브리타임: "에브리타임",
  "학과 정보": "UsersRound",
  쿨하우스: "Bed",
  KUNG: "MessageCircleMore",
  게시판: "ScrollText",
  현장실습: "Building",
  창업지원: "Lightbulb",
};

test("모든 기본 링크를 명시적인 bundled icon에 연결한다", () => {
  for (const [label, expectedName] of Object.entries(expectedNamesByLabel)) {
    const result = matchTemplateIcon({ label, icon: label }, icons, "링크");
    assert.equal(result?.icon.name, expectedName, label);
    assert.equal(result?.usedFallback, false, label);
  }
});

test("알 수 없는 링크는 첫 아이콘이 아니라 범용 링크 아이콘을 사용한다", () => {
  const result = matchTemplateIcon(
    { label: "알 수 없는 링크", icon: "unknown" },
    icons,
    "링크",
  );

  assert.equal(result?.icon.name, "링크");
  assert.equal(result?.usedFallback, true);
});
