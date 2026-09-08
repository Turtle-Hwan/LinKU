import { expect, test } from "../extension.fixture.ts";

test("갤러리 미리보기는 페이지 추가와 검색 결과 교체를 따른다", async ({ extension }) => {
  const { context, popupUrl } = extension;
  let lastSort = '';
  await context.route("https://example.supabase.co/rest/v1/rpc/browse_publications", async (route) => {
    const { p_offset: offset, p_query: query } = route.request().postDataJSON();
    lastSort = route.request().postDataJSON().p_sort;
    await route.fulfill({ json: Array.from({ length: query || offset ? 1 : 12 }, (_, index) => ({
      template_id: `00000000-0000-4000-8000-${String(offset + index).padStart(12, "0")}`,
      snapshot: { version: 1, name: query || `게시물 ${offset + index}`, height: 1, items: [] },
      revision: 1, author_nickname: "따뜻한 건구스", like_count: 0, clone_count: 0,
      published_at: "2026-09-07T00:00:00Z", updated_at: "2026-09-07T00:00:00Z", is_liked: false,
    })) });
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${popupUrl}#/gallery`);
  await expect(page.locator("article")).toHaveCount(12);
  await expect(page.getByRole("heading", { name: "게시물 0", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "더 보기", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(13);
  await expect(page.getByRole("heading", { name: "게시물 12", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "더 보기", exact: true })).toHaveCount(0);
  await page.getByRole("textbox", { name: "템플릿 검색" }).fill("검색 결과");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "검색 결과", exact: true })).toBeVisible();
  await page.getByRole('button', { name: '오래된순' }).click();
  await expect.poll(() => lastSort).toBe('oldest');
  await expect(page.getByRole('button', { name: '오래된순' })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test("빈 템플릿은 표시하고 손상된 게시물은 안내하며 다음 페이지를 유지한다", async ({ extension }, testInfo) => {
  const { context, popupUrl } = extension;
  const offsets: number[] = [];
  await context.route("https://example.supabase.co/rest/v1/rpc/browse_publications", async (route) => {
    const { p_offset: offset, p_query: query } = route.request().postDataJSON();
    offsets.push(offset);
    await route.fulfill({ json: Array.from({ length: query || offset >= 24 ? 1 : 12 }, (_, index) => ({
      template_id: `00000000-0000-4000-8000-${String(offset + index).padStart(12, "0")}`,
      snapshot: query === "복구" || (!query && index === 0 && offset !== 12)
        ? { version: 1, name: query || `빈 템플릿 ${offset}`, height: 1, items: [] }
        : {},
      revision: 1, author_nickname: "따뜻한 건구스", like_count: 0, clone_count: 0,
      published_at: "2026-09-08T00:00:00Z", updated_at: "2026-09-08T00:00:00Z", is_liked: false,
    })) });
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${popupUrl}#/gallery`);
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "빈 템플릿 0", exact: true })).toBeVisible();
  const notice = page.getByRole("status").filter({ hasText: "데이터 형식" });
  await expect(notice).toContainText("11개를 표시하지 못했습니다");
  for (const width of [320, 375, 500, 768]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(notice).toBeVisible();
    expect(await notice.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`gallery-validation-${width}.png`), fullPage: true });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  const more = page.getByRole("button", { name: "더 보기", exact: true });
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(notice).toContainText("23개를 표시하지 못했습니다");
  await expect(page.locator("article")).toHaveCount(1);
  await more.click();
  await expect(page.locator("article")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "빈 템플릿 24", exact: true })).toBeVisible();
  await expect(more).toHaveCount(0);
  expect(offsets).toEqual([0, 12, 24]);

  await page.getByRole("textbox", { name: "템플릿 검색" }).fill("손상된 결과");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(0);
  await expect(notice).toContainText("1개를 표시하지 못했습니다");
  await expect(page.getByText("검색 결과가 없습니다.", { exact: true })).toHaveCount(0);
  await page.getByRole("textbox", { name: "템플릿 검색" }).fill("복구");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(1);
  await expect(notice).toHaveCount(0);
  expect(errors).toEqual([]);
});
