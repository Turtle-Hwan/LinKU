import type { Page, Worker } from "@playwright/test";
import type { EverytimeTimetable } from "../../../src/types/timetable.ts";
import { expect, test } from "../extension.fixture.ts";

// Include cold Chromium/profile startup; capture latency has its own 3s guard.
test.describe.configure({ timeout: 60_000 });

// Synthetic responses only: no account identifiers, cookies, or captured HTML.
const SEMESTER = "2026년 2학기";
const EVERYTIME_URL = "https://everytime.kr/timetable";
const EVERYTIME_ROUTE = /^https:\/\/everytime\.kr\/timetable(?:\/.*)?$/;
const ONLINE_TITLES = ["컴퓨팅적사고", "취창업전략"];
const nontimeMarkup = (titles: string[]) => titles.map((title) =>
  `<div class="subject"><span class="name">${title}</span></div>`,
).join("");
const timetableHtml = (titles = ONLINE_TITLES) => `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"></head><body>
  <select id="semesters"><option selected>${SEMESTER}</option></select>
  <div id="container" class="timetable">
    <table class="tablehead"><tr><th>월</th><th>화</th><th>수</th><th>목</th><th>금</th></tr></table>
    <div class="tablebody">
      <table class="tablebody"><tr><td><div class="grids"><div class="grid"></div></div></td></tr></table>
      <div class="nontimes">${nontimeMarkup(titles)}</div>
    </div>
  </div>
</body></html>`;

const tableXml = `<response><table id="fixture-table" name="기본 시간표" year="2026" semester="2">
  <subject id="course-a"><name value="자료구조"/><professor value="김교수"/>
    <time><data day="0" starttime="108" endtime="126"/><data day="2" starttime="108" endtime="126"/></time>
  </subject>
  <subject id="course-b"><name value="운영체제"/><professor value="이교수"/>
    <time><data day="1" starttime="108" endtime="126"/></time>
  </subject>
  <subject id="online-a"><name value="컴퓨팅적사고"/><professor value="온라인교수"/><credit value="3"/><time value="이러닝"/></subject>
  <subject id="online-b"><name value="취창업전략"/><time value="이러닝"/></subject>
</table></response>`;

async function findContentTab(worker: Worker) {
  const tabId = await worker.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url });
    return tab?.id;
  }, EVERYTIME_URL);
  expect(tabId).toBeDefined();
  await expect.poll(async () => worker.evaluate(async (id) => {
    try {
      return await chrome.tabs.sendMessage(id, { type: "LINKU_EVERYTIME_CAPTURE_PING" });
    } catch {
      return null;
    }
  }, tabId!)).toEqual({ success: true, ready: true });
  return tabId!;
}

async function captureDom(worker: Worker, tabId: number) {
  return worker.evaluate(async ({ id, semester }) => {
    const start = performance.now();
    const response = await chrome.tabs.sendMessage(id, {
      type: "LINKU_EVERYTIME_CAPTURE_CURRENT", data: { semester },
    });
    return { response, elapsedMs: performance.now() - start };
  }, { id: tabId, semester: SEMESTER });
}

async function readSavedSnapshot(worker: Worker): Promise<EverytimeTimetable> {
  return worker.evaluate(async () => {
    const { timetableAssetIndex: index } = await chrome.storage.local.get("timetableAssetIndex");
    return index?.assets[0]?.snapshot;
  });
}

async function openTimetablePopup(page: Page, popupUrl: string) {
  await page.goto(popupUrl);
  await page.getByRole("tab", { name: "시간표" }).click();
  await page.getByRole("button", { name: "에브리타임에서 가져오기", exact: true }).click();
  await expect(page.getByRole("region", { name: "이러닝 및 시간 미정 수업" })).toBeVisible({ timeout: 15_000 });
}

test("API 가져오기 → 저장 → 팝업에서 이러닝과 동일 과목의 여러 교시를 보존한다", async ({ extension }) => {
  const { context, worker, popupUrl } = extension;
  const requests: string[] = [];
  await context.route(EVERYTIME_ROUTE, (route) => route.fulfill({
    contentType: "text/html", body: timetableHtml(["DOM 폴백을 사용하면 안 됨"]),
  }));
  await context.route("https://api.everytime.kr/find/timetable/**", (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    requests.push(path);
    expect(request.method()).toBe("POST");
    let body: string;
    if (path.endsWith("/subject/semester/list")) {
      body = '<response><semester year="2026" semester="2"/></response>';
    } else if (path.endsWith("/table/list/semester")) {
      expect(request.postData()).toBe("year=2026&semester=2");
      body = '<response><table id="fixture-table" is_primary="1"/></response>';
    } else {
      expect(path).toBe("/find/timetable/table");
      expect(request.postData()).toBe("id=fixture-table");
      body = tableXml;
    }
    return route.fulfill({ contentType: "application/xml", body,
      headers: { "Access-Control-Allow-Origin": "https://everytime.kr", "Access-Control-Allow-Credentials": "true" },
    });
  });
  const sourcePage = await context.newPage();
  await sourcePage.goto(EVERYTIME_URL);
  await findContentTab(worker);
  const popup = await context.newPage();
  await openTimetablePopup(popup, popupUrl);

  const snapshot = await readSavedSnapshot(worker);
  expect(requests).toHaveLength(3);
  expect(snapshot.courses).toHaveLength(4);
  expect(snapshot.subjects).toHaveLength(3);
  expect(snapshot.courses?.find((course) => course.id === "online-a")).toMatchObject({
    title: "컴퓨팅적사고", professor: "온라인교수", credit: 3, timeText: "이러닝", meetings: [],
  });
  const repeatedColors = await popup.getByRole("article", { name: /자료구조/u })
    .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor));
  expect(repeatedColors).toEqual(["rgb(254, 229, 229)", "rgb(254, 229, 229)"]);
  await expect(popup.getByRole("row")).toHaveCount(2);
  await expect(popup.getByText("DOM 폴백을 사용하면 안 됨")).toHaveCount(0);
  await popup.reload();
  await popup.getByRole("tab", { name: "시간표" }).click();
  await expect(popup.getByText("컴퓨팅적사고")).toBeVisible();
});

test("API 실패 시 이러닝-only DOM으로 폴백하고 임시 탭을 정리한다", async ({ extension }, testInfo) => {
  const { context, worker, popupUrl } = extension;
  const htmlRequests: string[] = [];
  let apiRequests = 0;
  await context.route(EVERYTIME_ROUTE, (route) => {
    htmlRequests.push(route.request().url());
    return route.fulfill({ contentType: "text/html", body: timetableHtml() });
  });
  await context.route("https://api.everytime.kr/**", (route) => {
    apiRequests += 1;
    return route.fulfill({ status: 503, body: "Fixture API unavailable",
      headers: { "Access-Control-Allow-Origin": "https://everytime.kr", "Access-Control-Allow-Credentials": "true" },
    });
  });
  const sourcePage = await context.newPage();
  await sourcePage.goto(EVERYTIME_URL);
  const tabId = await findContentTab(worker);
  const captured = await captureDom(worker, tabId);
  expect(captured.response.success).toBe(true);
  expect(captured.elapsedMs).toBeLessThan(3_000);
  testInfo.annotations.push({ type: "DOM capture duration", description: `${captured.elapsedMs.toFixed(0)} ms` });
  const popup = await context.newPage();
  // Chromium can begin an extension-created tab's initial request before
  // Playwright attaches its network routes. Create the real tab blank, then
  // navigate it after attachment so the test never needs a live login session.
  // Capture, storage, message handling, and tab cleanup remain unmodified.
  await worker.evaluate(() => {
    const createTab = chrome.tabs.create.bind(chrome.tabs);
    chrome.tabs.create = ((options: chrome.tabs.CreateProperties) => {
      (globalThis as typeof globalThis & { fixtureNavigationUrl?: string })
        .fixtureNavigationUrl = options.url;
      return createTab({ ...options, url: "about:blank" });
    }) as typeof chrome.tabs.create;
  });
  const temporaryPagePromise = context.waitForEvent("page");
  const importPromise = openTimetablePopup(popup, popupUrl);
  const temporaryPage = await temporaryPagePromise;
  const requestedUrl = await worker.evaluate(() =>
    (globalThis as typeof globalThis & { fixtureNavigationUrl?: string }).fixtureNavigationUrl);
  expect(requestedUrl).toBe(`${EVERYTIME_URL}/2026/2`);
  await temporaryPage.goto(requestedUrl!);
  await importPromise;
  expect(apiRequests).toBeGreaterThan(0);
  expect(htmlRequests).toContain(`${EVERYTIME_URL}/2026/2`);
  const snapshot = await readSavedSnapshot(worker);
  expect(snapshot.subjects).toEqual([]);
  expect(snapshot.courses?.map((course) => course.title)).toEqual(ONLINE_TITLES);
  await expect(popup.locator("[data-everytime-schedule-grid]")).toHaveCount(0);
  await expect(popup.getByRole("row")).toHaveCount(2);
  await expect(popup.getByText("정해진 요일과 시간이 있는 수업은 없습니다.")).toBeVisible();
  await expect.poll(() => context.pages().filter((page) => page.url().startsWith(EVERYTIME_URL)).length).toBe(1);
  expect(sourcePage.isClosed()).toBe(false);
  await testInfo.attach("timetable-elearning-only", { body: await popup.screenshot(), contentType: "image/png" });
});

for (const courseCount of [2, 51]) {
  test(`늦게 렌더된 이러닝 ${courseCount}과목에 observer가 즉시 응답한다`, async ({ extension }, testInfo) => {
    const { context, worker } = extension;
    await context.route(EVERYTIME_ROUTE, (route) => route.fulfill({ contentType: "text/html", body: timetableHtml([]) }));
    const sourcePage = await context.newPage();
    await sourcePage.goto(EVERYTIME_URL);
    const tabId = await findContentTab(worker);
    const pendingCapture = captureDom(worker, tabId);
    await sourcePage.evaluate((markup) => new Promise<void>((resolve) => {
      setTimeout(() => {
        document.querySelector(".nontimes")!.innerHTML = markup;
        resolve();
      }, 250);
    }), nontimeMarkup(Array.from({ length: courseCount }, (_, index) => `온라인 과목 ${index}`)));
    const { response, elapsedMs } = await pendingCapture;
    expect(elapsedMs).toBeLessThan(3_000);
    expect(response.success).toBe(true);
    expect(response.timetable.courses).toHaveLength(courseCount);
    testInfo.annotations.push({ type: "DOM capture duration", description: `${elapsedMs.toFixed(0)} ms` });
  });
}
