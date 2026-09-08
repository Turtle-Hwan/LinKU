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
