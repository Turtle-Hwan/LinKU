import type { BrowserContext, Worker } from "@playwright/test";

import { expect, test } from "./extension.fixture.ts";

interface ActionPopupTarget {
  targetId: string;
  type: string;
  url: string;
}

const openActionPopup = async (
  context: BrowserContext,
  worker: Worker,
  popupUrl: string,
) => {
  const hostPage = context.pages()[0] ?? (await context.newPage());
  await hostPage.bringToFront();

  const cdpSession = await context.newCDPSession(hostPage);
  const { targetInfos: targetsBeforeAction } = await cdpSession.send(
    "Target.getTargets",
  );
  const targetIdsBeforeAction = new Set(
    targetsBeforeAction.map(({ targetId }) => targetId),
  );

  let actionPopupTarget: ActionPopupTarget | undefined;
  try {
    await worker.evaluate(async () => {
      await chrome.action.openPopup();
    });
    await expect
      .poll(async () => {
        const { targetInfos } = await cdpSession.send("Target.getTargets");
        actionPopupTarget = targetInfos.find(
          ({ targetId, url }) =>
            !targetIdsBeforeAction.has(targetId) && url.startsWith(popupUrl),
        );
        return actionPopupTarget !== undefined;
      })
      .toBe(true);
  } finally {
    await cdpSession.detach();
  }

  if (!actionPopupTarget) {
    throw new Error("The extension action did not create a popup target.");
  }
  return actionPopupTarget;
};

test("빌드된 MV3 확장과 action popup을 로드한다", async ({ extension }) => {
  test.setTimeout(60_000);

  const { context, worker, extensionId, popupUrl } = extension;
  expect(new URL(worker.url()).pathname).toBe("/background/index.js");

  const popup = await context.newPage();
  await popup.goto(popupUrl);
  await expect(popup).toHaveTitle("LinKU");
  await expect(popup.locator("#root > div")).toBeVisible();
  await expect(popup.getByPlaceholder("검색어 입력")).toBeVisible();

  const actionPopupTarget = await openActionPopup(context, worker, popupUrl);
  expect(actionPopupTarget.url.startsWith(popupUrl)).toBe(true);
  expect(["other", "page"]).toContain(actionPopupTarget.type);
  expect(new URL(actionPopupTarget.url).host).toBe(extensionId);
});
