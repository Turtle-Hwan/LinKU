import { expect, test } from "../extension.fixture.ts";

test("Supabase 없이도 템플릿을 저장하고 다시 연다", async ({ extension }) => {
  test.setTimeout(60_000);

  const { context, popupUrl } = extension;
  await context.setOffline(true);
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${popupUrl}#/templates`);
  await expect(page.getByRole("heading", { name: "내 템플릿" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "새 템플릿" }).click();
  await page.getByRole("menuitem", { name: "빈 템플릿에서 시작" }).click();
  await expect(page.getByPlaceholder("템플릿 이름")).toBeVisible();

  await page.getByPlaceholder("템플릿 이름").fill("오프라인 회귀 템플릿");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/#\/editor\/\d+$/u);

  await page.reload();
  await expect(page.getByPlaceholder("템플릿 이름")).toHaveValue(
    "오프라인 회귀 템플릿",
  );

  await page.goto(`${popupUrl}#/templates`);
  await expect(page.getByText("오프라인 회귀 템플릿")).toBeVisible();
  await expect(page.getByText("이 기기에 저장", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "둘러보기" }).click();
  await expect(page.getByText("커뮤니티에 연결할 수 없어")).toBeVisible();
  await expect(page.getByRole("button", { name: "기본 템플릿 가져오기" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
