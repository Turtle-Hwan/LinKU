import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createEverytimeNontimeCourses,
  hasEverytimeTimetableData,
  isPrimaryEverytimeTable,
} from "../../src/utils/everytimeTimetableParsing.ts";

function readAttribute(attributes: string, name: string): string | null {
  return attributes.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

test("legacy primary와 current is_primary 속성을 모두 인식한다", async () => {
  const fixture = await readFile(
    new URL("../fixtures/everytime-table-list.xml", import.meta.url),
    "utf8",
  );
  const tables = [...fixture.matchAll(/<table\b([^>]*)\/>/g)].map(
    (match) => match[1],
  );
  const primaryIds = tables
    .filter((attributes) =>
      isPrimaryEverytimeTable(
        readAttribute(attributes, "primary"),
        readAttribute(attributes, "is_primary"),
      ),
    )
    .map((attributes) => readAttribute(attributes, "id"));

  assert.deepEqual(primaryIds, ["primary-legacy", "primary-current"]);
  assert.equal(isPrimaryEverytimeTable("0", "0"), false);
  assert.equal(isPrimaryEverytimeTable(null, null), false);
});

test("DOM fallback fixture는 현재 7요일 단일 행 좌표계를 보존한다", async () => {
  const fixture = await readFile(
    new URL("../fixtures/everytime-timetable.html", import.meta.url),
    "utf8",
  );

  assert.equal((fixture.match(/<td[> ]/g) ?? []).length, 7);
  assert.match(fixture, /top:\s*450px/);
  assert.match(fixture, /height:\s*75px/);
});

test("에브리타임 nontimes 행을 시간 미지정 과목으로 구조화한다", () => {
  assert.deepEqual(
    createEverytimeNontimeCourses("2026년 2학기", [
      " 벤처창업및경영 ",
      "",
      "보이지않는미생물세계",
    ]),
    [
      {
        id: "2026년 2학기:nontime:0",
        title: "벤처창업및경영",
        meetings: [],
      },
      {
        id: "2026년 2학기:nontime:2",
        title: "보이지않는미생물세계",
        meetings: [],
      },
    ],
  );
});

test("시간 지정 과목 없이 이러닝 과목만 있어도 시간표 데이터로 판단한다", () => {
  assert.equal(
    hasEverytimeTimetableData({
      semester: "2026년 2학기",
      courses: [
        {
          id: "course-online",
          title: "컴퓨팅적사고",
          meetings: [],
        },
      ],
      weekdays: ["월", "화", "수", "목", "금", "토", "일"],
      slotCount: 48,
      subjects: [],
    }),
    true,
  );
  assert.equal(
    hasEverytimeTimetableData({
      semester: "2026년 2학기",
      courses: [],
      weekdays: ["월", "화", "수", "목", "금", "토", "일"],
      slotCount: 48,
      subjects: [],
    }),
    false,
  );
  assert.equal(hasEverytimeTimetableData(null), false);
});
