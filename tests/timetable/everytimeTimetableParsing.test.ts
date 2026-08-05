import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isPrimaryEverytimeTable } from "../../src/utils/everytimeTimetableParsing.ts";

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
