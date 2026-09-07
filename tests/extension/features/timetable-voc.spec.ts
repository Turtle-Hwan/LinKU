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
  expect(new Set(backgroundColors).size).toBe(backgroundColors.length);
  expect(backgroundColors).toEqual([
    "rgb(247, 161, 161)", "rgb(161, 247, 161)",
    "rgb(161, 161, 247)", "rgb(247, 208, 161)",
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

for (const courseCount of [50, 51]) {
  test(`저장된 ${courseCount}과목의 팔레트 경계를 안전하게 표시한다`, async ({ extension }) => {
    const { context, popupUrl, worker } = extension;
    await seedTimetable(worker);
    await worker.evaluate(async ({ storageKey, count }) => {
      const { [storageKey]: index } = await chrome.storage.local.get(storageKey);
      index.assets[0].snapshot.subjects = [];
      index.assets[0].snapshot.courses = Array.from({ length: count }, (_, i) => ({
        id: `course-${i}`, title: `과목 ${i}`, meetings: [],
      }));
      await chrome.storage.local.set({ [storageKey]: index });
    }, { storageKey: TIMETABLE_STORAGE_KEY, count: courseCount });
    const popup = await context.newPage();
    const pageErrors: string[] = [];
    popup.on("pageerror", (error) => pageErrors.push(error.message));
    await popup.goto(popupUrl);
    await popup.getByRole("tab", { name: "시간표" }).focus();
    await popup.keyboard.press("Enter");
    if (courseCount === 50) {
      await expect(popup.getByRole("row")).toHaveCount(50);
      const colors = await popup.locator("[data-everytime-unscheduled-course]")
        .evaluateAll((rows) => rows.map((row) => getComputedStyle(row).backgroundColor));
      expect(new Set(colors).size).toBe(50);
      await popup.getByRole("row").last().scrollIntoViewIfNeeded();
      await expect(popup.getByRole("row").last()).toBeInViewport();
    } else {
      await expect(popup.getByRole("alert")).toContainText("과목이 50개를 넘어");
    }
    await expect(popup.getByRole("button", { name: "동기화", exact: true })).toBeEnabled();
    expect(pageErrors).toEqual([]);
  });
}
