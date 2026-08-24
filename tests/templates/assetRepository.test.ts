import assert from "node:assert/strict";
import test from "node:test";

import { createTemplateTestServer } from "./viteTestServer.ts";

test("사용자 아이콘 이름과 크기 오류는 validation으로 구분한다", async () => {
  const server = await createTemplateTestServer();

  try {
    const module = (await server.ssrLoadModule(
      "/src/storage/assetRepository.ts",
    )) as typeof import("../../src/storage/assetRepository.ts");

    await assert.rejects(
      module.saveAsset("", new Blob([Uint8Array.from([1])])),
      (error) => error instanceof module.AssetValidationError,
    );
    await assert.rejects(
      module.saveAsset(
        "큰 아이콘",
        new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]),
      ),
      (error) => error instanceof module.AssetValidationError,
    );
  } finally {
    await server.close();
  }
});
