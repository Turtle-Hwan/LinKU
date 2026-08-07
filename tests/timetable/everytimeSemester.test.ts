import assert from "node:assert/strict";
import test from "node:test";
import {
  formatEverytimeSemester,
  getLatestEverytimeSemesterAnchor,
  parseEverytimeSemester,
} from "../../src/utils/everytimeSemester.ts";

test("에브리타임 학기 문자열을 구조화한다", () => {
  assert.deepEqual(parseEverytimeSemester("2026년 여름학기"), {
    label: "2026년 여름학기",
    year: 2026,
    term: "여름",
    sortKey: 2026 * 4 + 1,
  });
  assert.equal(parseEverytimeSemester("2026년 3학기"), null);
  assert.equal(formatEverytimeSemester(2025, "겨울"), "2025년 겨울학기");
});

test("학사 시기별 최신 탐색 기준을 선택한다", () => {
  assert.deepEqual(getLatestEverytimeSemesterAnchor(new Date(2026, 0, 1)), {
    year: 2026,
    term: "1",
    sortKey: 2026 * 4,
  });
  assert.equal(
    getLatestEverytimeSemesterAnchor(new Date(2026, 4, 31)).term,
    "1",
  );
  assert.equal(
    getLatestEverytimeSemesterAnchor(new Date(2026, 5, 1)).term,
    "2",
  );
  assert.equal(
    getLatestEverytimeSemesterAnchor(new Date(2026, 10, 30)).term,
    "2",
  );
  assert.deepEqual(getLatestEverytimeSemesterAnchor(new Date(2026, 11, 1)), {
    year: 2027,
    term: "1",
    sortKey: 2027 * 4,
  });
});
