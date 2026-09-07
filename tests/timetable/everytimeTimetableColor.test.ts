import assert from "node:assert/strict";
import test from "node:test";
import { createEverytimeSubjectColorMap } from "../../src/utils/everytimeTimetableColor.ts";

const OKLAB_SCALE = 100;
const MINIMUM_PALETTE_DISTANCE = 3.8;
const MINIMUM_COMMON_PALETTE_DISTANCE = 6.8;
const MINIMUM_TEXT_CONTRAST_RATIO = 7.5;
const SUBJECT_TEXT_COLOR = "#171717";

function parseHexColor(color: string): [number, number, number] {
  assert.match(color, /^#[0-9a-f]{6}$/iu);
  return [1, 3, 5].map((start) =>
    Number.parseInt(color.slice(start, start + 2), 16),
  ) as [number, number, number];
}

function toLinearSrgb(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function toOklab(color: string): [number, number, number] {
  const [red, green, blue] = parseHexColor(color).map(toLinearSrgb);
  const long = Math.cbrt(
    0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue,
  );
  const medium = Math.cbrt(
    0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue,
  );
  const short = Math.cbrt(
    0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue,
  );

  return [
    (0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short) *
      OKLAB_SCALE,
    (1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short) *
      OKLAB_SCALE,
    (0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short) *
      OKLAB_SCALE,
  ];
}

function getMinimumOklabDistance(colors: readonly string[]): number {
  const oklabColors = colors.map(toOklab);
  let minimumDistance = Number.POSITIVE_INFINITY;

  oklabColors.forEach((color, colorIndex) => {
    oklabColors.slice(colorIndex + 1).forEach((otherColor) => {
      const distance = Math.hypot(
        color[0] - otherColor[0],
        color[1] - otherColor[1],
        color[2] - otherColor[2],
      );
      minimumDistance = Math.min(minimumDistance, distance);
    });
  });

  return minimumDistance;
}

function getRelativeLuminance(color: string): number {
  const [red, green, blue] = parseHexColor(color).map(toLinearSrgb);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function getContrastRatio(background: string, foreground: string): number {
  const lighter = Math.max(
    getRelativeLuminance(background),
    getRelativeLuminance(foreground),
  );
  const darker = Math.min(
    getRelativeLuminance(background),
    getRelativeLuminance(foreground),
  );
  return (lighter + 0.05) / (darker + 0.05);
}

test("서로 다른 과목에 서로 다른 파스텔 색을 배정한다", () => {
  const colors = createEverytimeSubjectColorMap([
    "course-a",
    "course-b",
    "course-c",
  ]);

  assert.equal(colors.get("course-a"), "#f7a1a1");
  assert.equal(colors.get("course-b"), "#a1f7a1");
  assert.equal(colors.get("course-c"), "#a1a1f7");
  assert.equal(new Set(colors.values()).size, 3);
});

test("50개 과목까지 선별된 팔레트 색이 중복되지 않는다", () => {
  const candidates = Array.from({ length: 50 }, (_, index) => `course-${index}`);
  const colors = createEverytimeSubjectColorMap(candidates);

  assert.equal(colors.size, candidates.length);
  assert.equal(new Set(colors.values()).size, candidates.length);
  colors.forEach((color) => assert.match(color, /^#[0-9a-f]{6}$/u));
});

test("50색 전체와 자주 쓰이는 앞쪽 색의 지각 거리를 유지한다", () => {
  const colors = [
    ...createEverytimeSubjectColorMap(
      Array.from({ length: 50 }, (_, index) => `course-${index}`),
    ).values(),
  ];

  assert.ok(
    getMinimumOklabDistance(colors) >= MINIMUM_PALETTE_DISTANCE,
    "50색 전체의 최소 OKLab 거리가 기준보다 작습니다.",
  );
  assert.ok(
    getMinimumOklabDistance(colors.slice(0, 10)) >=
      MINIMUM_COMMON_PALETTE_DISTANCE,
    "자주 쓰이는 앞 10색의 최소 OKLab 거리가 기준보다 작습니다.",
  );
});

test("파스텔 배경 50색 모두 본문과 높은 대비를 유지한다", () => {
  const colors = createEverytimeSubjectColorMap(
    Array.from({ length: 50 }, (_, index) => `course-${index}`),
  );

  colors.forEach((color) => {
    assert.ok(
      getContrastRatio(color, SUBJECT_TEXT_COLOR) >=
        MINIMUM_TEXT_CONTRAST_RATIO,
      `${color} 배경의 본문 대비가 기준보다 작습니다.`,
    );
  });
});

test("50개를 넘으면 색을 재사용하지 않고 명시적으로 거부한다", () => {
  const candidates = Array.from({ length: 51 }, (_, index) => `course-${index}`);

  assert.throws(
    () => createEverytimeSubjectColorMap(candidates),
    /최대 50개의 고유 과목 색상/u,
  );
});

test("같은 과목 키의 여러 수업은 하나의 안정된 색을 공유한다", () => {
  const candidates = [
    "course-a",
    "course-b",
    "course-a",
  ];

  assert.deepEqual(
    createEverytimeSubjectColorMap(candidates),
    createEverytimeSubjectColorMap(candidates),
  );
  assert.equal(createEverytimeSubjectColorMap(candidates).size, 2);
});
