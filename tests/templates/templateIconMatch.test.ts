import assert from "node:assert/strict";
import test from "node:test";

import type { Icon } from "../../src/types/api.ts";
import { matchTemplateIcon } from "../../src/utils/templateIconMatch.ts";
import { createTemplateTestServer } from "./viteTestServer.ts";

test("실제 기본 링크 catalog의 모든 항목을 bundled icon에 연결한다", async () => {
  const server = await createTemplateTestServer();

  try {
    const { LINK_CATALOG } = (await server.ssrLoadModule(
      "/src/constants/linkCatalog.ts",
    )) as {
      LINK_CATALOG: Array<{ icon: unknown; label: string }>;
    };
    const { GENERIC_LINK_ICON_NAME, getBundledTemplateIcons } =
      (await server.ssrLoadModule("/src/constants/templateIcons.ts")) as {
        GENERIC_LINK_ICON_NAME: string;
        getBundledTemplateIcons: () => Icon[];
      };
    const bundledIcons = getBundledTemplateIcons();

    for (const [index, link] of LINK_CATALOG.entries()) {
      const result = matchTemplateIcon(
        link,
        bundledIcons,
        GENERIC_LINK_ICON_NAME,
      );
      assert.equal(result?.icon.id, index + 1, link.label);
      assert.equal(result?.usedFallback, false, link.label);
    }
  } finally {
    await server.close();
  }
});

test("알 수 없는 링크는 첫 아이콘이 아니라 범용 링크 아이콘을 사용한다", () => {
  const icons: Icon[] = ["University", "링크"].map((name, index) => ({
    id: index + 1,
    name,
    imageUrl: `data:image/png;base64,${index}`,
    isDefault: true,
  }));
  const result = matchTemplateIcon(
    { label: "알 수 없는 링크", icon: "unknown" },
    icons,
    "링크",
  );

  assert.equal(result?.icon.name, "링크");
  assert.equal(result?.usedFallback, true);
});
