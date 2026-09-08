import { expect, test } from '../extension.fixture.ts';

test('오프라인 아이콘 업로드·이름 변경·사용 중 삭제 차단·개별 삭제', async ({ extension }, testInfo) => {
  const { context, popupUrl } = extension;
  await context.setOffline(true);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${popupUrl}#/editor?from=empty`);
  await page.getByRole('button', { name: '아이콘 업로드', exact: true }).click();
  const upload = page.getByRole('dialog');
  await upload.locator('input[type=file]').setInputFiles({
    name: '테스트 아이콘.svg', mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" rx="8" fill="#147d57"/><circle cx="24" cy="24" r="12" fill="white"/></svg>'),
  });
  await upload.getByRole('button', { name: '업로드', exact: true }).click();
  await expect(upload).not.toBeVisible();
  await page.getByRole('button', { name: '내 아이콘 관리' }).click();
  const manager = page.getByRole('dialog');
  await manager.getByRole('button', { name: '테스트 아이콘 이름 변경' }).click();
  const longName = '따뜻한 건구스의 즐겨찾기 아이콘 이름이 길어져도 잘 보이는지 확인';
  await manager.getByRole('textbox', { name: '아이콘 이름' }).fill(longName);
  await manager.getByRole('textbox', { name: '아이콘 이름' }).press('Enter');
  await expect(manager.getByRole('button', { name: `${longName} 이름 변경` })).toBeVisible();

  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const bounds = await manager.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(await manager.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`icon-manager-${width}.png`) });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await manager.getByRole('button', { name: `${longName} 이름 변경` }).click();
  await manager.getByRole('textbox', { name: '아이콘 이름' }).fill('내 아이콘');
  await manager.getByRole('textbox', { name: '아이콘 이름' }).press('Enter');
  await expect(manager.getByRole('button', { name: '내 아이콘 이름 변경' })).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(manager).not.toBeVisible();
  await page.getByRole('button', { name: '빠른 링크 추가', exact: true }).click();
  const quickAdd = page.getByRole('dialog');
  await quickAdd.getByLabel(/링크 이름/).fill('나의 링크');
  await quickAdd.getByLabel('링크 URL').fill('https://example.com');
  await quickAdd.getByRole('tab', { name: '내 아이콘 (1)' }).click();
  await quickAdd.getByRole('button', { name: '내 아이콘', exact: true }).click();
  await quickAdd.getByRole('button', { name: '추가', exact: true }).click();
  await page.getByRole('button', { name: '내 아이콘 관리' }).click();
  await expect(manager.getByRole('button', { name: '내 아이콘 삭제' })).toBeDisabled();
  await expect(manager.getByText('현재 편집 중인 템플릿에서 사용 중')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page).toHaveURL(/#\/editor\/\d+$/u);
  await page.reload();
  await page.getByRole('button', { name: '내 아이콘 관리' }).click();
  await expect(manager.getByRole('button', { name: '내 아이콘 삭제' })).toBeDisabled();
  await page.keyboard.press('Escape');

  // A separate empty editor still cannot delete a saved template's icon.
  await page.goto(`${popupUrl}#/editor?from=empty`);
  await page.getByRole('button', { name: '내 아이콘 관리' }).click();
  await manager.getByRole('button', { name: '내 아이콘 삭제' }).click();
  await manager.getByRole('button', { name: '삭제 확인' }).click();
  await expect(page.getByText('템플릿에서 사용 중인 아이콘입니다.', { exact: false })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto(`${popupUrl}#/templates`);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await page.goto(`${popupUrl}#/editor?from=empty`);
  await page.getByRole('button', { name: '내 아이콘 관리' }).click();
  await manager.getByRole('button', { name: '내 아이콘 삭제' }).click();
  await manager.getByRole('button', { name: '삭제 확인' }).click();
  await expect(manager.getByText('등록한 아이콘이 없습니다.', { exact: false })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: '내 아이콘 관리' }).click();
  await expect(manager.getByText('등록한 아이콘이 없습니다.', { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});
