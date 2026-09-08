import type { Worker } from "@playwright/test";

import { expect, test } from "../extension.fixture.ts";

const TIMETABLE_STORAGE_KEY = "timetableAssetIndex";
const ASSET_ID = "everytime:2026년 2학기";

const seedTimetable = async (worker: Worker) => {
  const now = "2026-09-05T00:00:00.000Z";
  await worker.evaluate(
    async ({ assetId, storageKey, timestamp }) => {
      await chrome.storage.local.set({
        [storageKey]: {
          schemaVersion: 3,
          activeAssetId: assetId,
          assets: [
            {
              schemaVersion: 3,
              id: assetId,
              source: "everytime",
              semester: "2026년 2학기",
              snapshotChecksum: "e2e-timetable-voc",
              syncStatus: "local",
              createdAt: timestamp,
              updatedAt: timestamp,
              snapshot: {
                semester: "2026년 2학기",
                weekdays: ["월", "화", "수", "목", "금", "토", "일"],
                slotCount: 48,
                courses: [
                  {
                    id: "course-a",
                    title: "자료구조",
                    professor: "김교수",
                    meetings: [
                      { dayIndex: 0, startTime: 108, endTime: 126 },
                    ],
                  },
                  {
                    id: "course-b",
                    title: "운영체제",
                    professor: "이교수",
                    meetings: [
                      { dayIndex: 1, startTime: 108, endTime: 126 },
                    ],
                  },
                  {
                    id: "course-online",
                    title: "컴퓨팅적사고",
                    professor: "온라인교수",
                    timeText: "이러닝",
                    meetings: [],
                  },
                  {
                    id: "course-online-2",
                    title: "취창업전략",
                    professor: "박교수",
                    timeText: "이러닝",
                    meetings: [],
                  },
                ],
                subjects: [
                  {
                    id: "subject-a",
                    subjectId: "course-a",
                    dayIndex: 0,
                    title: "자료구조",
                    professor: "김교수",
                    color: "color1",
                    top: 450,
                    height: 75,
                  },
                  {
                    id: "subject-b",
                    subjectId: "course-b",
                    dayIndex: 1,
                    title: "운영체제",
                    professor: "이교수",
                    color: "color1",
                    top: 450,
                    height: 75,
                  },
                ],
              },
            },
          ],
        },
      });
    },
    {
      assetId: ASSET_ID,
      storageKey: TIMETABLE_STORAGE_KEY,
      timestamp: now,
    },
  );
};

test("이러닝 과목을 표시하고 과목별 색을 겹치지 않게 보정한다", async ({
  extension,
}, testInfo) => {
  test.setTimeout(60_000);

  const { context, popupUrl, worker } = extension;
  await seedTimetable(worker);

  const popup = await context.newPage();
  const pageErrors: string[] = [];
  popup.on("pageerror", (error) => pageErrors.push(error.message));
  await popup.goto(popupUrl);
  await popup.getByRole("tab", { name: "시간표" }).click();

  const unscheduledRegion = popup.getByRole("region", {
    name: "이러닝 및 시간 미정 수업",
  });
  await expect(unscheduledRegion).toBeVisible();
  await expect(
    unscheduledRegion.getByRole("heading", {
      name: "이러닝 · 시간 미지정",
    }),
  ).toBeVisible();
  await expect(unscheduledRegion.getByText("컴퓨팅적사고")).toBeVisible();
  await expect(unscheduledRegion.getByText("취창업전략")).toBeVisible();
  await expect(unscheduledRegion.getByRole("table")).toBeVisible();
  await expect(unscheduledRegion.getByRole("row")).toHaveCount(2);
  await expect(popup.getByRole("article", { name: /자료구조/u })).toBeVisible();
  await expect(popup.getByRole("article", { name: /운영체제/u })).toBeVisible();

  const scheduleGrid = popup.locator("[data-everytime-schedule-grid]");
  const [scheduleGridBox, unscheduledRegionBox] = await Promise.all([
    scheduleGrid.boundingBox(),
    unscheduledRegion.boundingBox(),
  ]);
  expect(scheduleGridBox).not.toBeNull();
  expect(unscheduledRegionBox).not.toBeNull();
  expect(unscheduledRegionBox!.y).toBeGreaterThanOrEqual(
    scheduleGridBox!.y + scheduleGridBox!.height,
  );

  const scheduledColorElements = [
    popup.getByRole("article", { name: /자료구조/u }),
    popup.getByRole("article", { name: /운영체제/u }),
  ];
  const scheduledBackgroundColors = await Promise.all(
    scheduledColorElements.map((element) =>
      element.evaluate((node) => getComputedStyle(node).backgroundColor),
    ),
  );
  const unscheduledBackgroundColors = await unscheduledRegion
    .locator("[data-everytime-unscheduled-course]")
    .evaluateAll((rows) =>
      rows.map((row) => getComputedStyle(row).backgroundColor),
    );
  const backgroundColors = [
    ...scheduledBackgroundColors,
    ...unscheduledBackgroundColors,
  ];
  expect(new Set(scheduledBackgroundColors).size).toBe(2);
  expect(backgroundColors).toEqual([
    "rgb(254, 229, 229)", "rgb(255, 239, 217)",
    "oklch(0.985 0 none)", "oklch(0.985 0 none)",
  ]);
  expect(await popup.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await popup.emulateMedia({ reducedMotion: "reduce" });
  await expect(unscheduledRegion.getByRole("row")).toHaveCount(2);

  await testInfo.attach("timetable-voc", {
    body: await popup.screenshot(),
    contentType: "image/png",
  });
  expect(pageErrors).toEqual([]);
});

for (const courseCount of [10, 11]) {
  test(`저장된 ${courseCount}과목의 팔레트 경계를 안전하게 표시한다`, async ({ extension }) => {
    const { context, popupUrl, worker } = extension;
    await seedTimetable(worker);
    await worker.evaluate(async ({ storageKey, count }) => {
      const { [storageKey]: index } = await chrome.storage.local.get(storageKey);
      const snapshot = index.assets[0].snapshot;
      const names = ["01 빨강", "02 주황", "03 노랑", "04 연두", "05 민트", "06 하늘", "07 파랑", "08 보라", "09 연보라", "10 회색", "11 빨강 재사용"];
      snapshot.courses = [
        ...snapshot.courses.filter((course: { meetings: unknown[] }) => course.meetings.length === 0),
        ...Array.from({ length: count }, (_, i) => ({
          id: `course-${i}`, title: names[i],
          meetings: [{ dayIndex: i % 5, startTime: 108 + Math.floor(i / 5) * 12, endTime: 120 + Math.floor(i / 5) * 12 }],
        })),
      ];
      snapshot.subjects = Array.from({ length: count }, (_, i) => ({
        id: `subject-${i}`, subjectId: `course-${i}`, title: names[i],
        dayIndex: i % 5, top: 450 + Math.floor(i / 5) * 50, height: 50, color: "color1",
      }));
      await chrome.storage.local.set({ [storageKey]: index });
    }, { storageKey: TIMETABLE_STORAGE_KEY, count: courseCount });
    const popup = await context.newPage();
    const pageErrors: string[] = [];
    popup.on("pageerror", (error) => pageErrors.push(error.message));
    await popup.goto(popupUrl);
    await popup.getByRole("tab", { name: "시간표" }).focus();
    await popup.keyboard.press("Enter");
    const cards = popup.getByRole("article");
    await expect(cards).toHaveCount(courseCount);
    const colors = await cards.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor));
    expect(new Set(colors).size).toBe(10);
    await expect(popup.getByRole("row")).toHaveCount(2);
    await expect(popup.getByRole("alert")).toHaveCount(0);
    if (courseCount === 11) {
      const firstColor = await popup.getByRole("article", { name: /01 빨강/u })
        .evaluate((node) => getComputedStyle(node).backgroundColor);
      await expect(popup.getByRole("article", { name: /11 빨강 재사용/u })).toHaveCSS("background-color", firstColor);
    }
    await popup.screenshot({ path: `docs/qa/pastel-${courseCount}-popup.png` });
    await expect(popup.getByRole("button", { name: "동기화", exact: true })).toBeEnabled();
    expect(pageErrors).toEqual([]);
  });
}
