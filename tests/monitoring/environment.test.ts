import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveSentryDistribution,
  resolveSentryEnvironment,
} from "../../src/monitoring/environment.ts";

test("로컬 확장 빌드를 development 환경으로 분류한다", () => {
  assert.equal(resolveSentryEnvironment(undefined, "development"), "development");
  assert.equal(resolveSentryEnvironment(undefined, "content"), "development");
});

test("배포 확장 빌드를 production 환경으로 분류한다", () => {
  assert.equal(resolveSentryEnvironment(undefined, "production"), "production");
  assert.equal(
    resolveSentryEnvironment(undefined, "production-content"),
    "production",
  );
});

test("명시한 Sentry 환경은 빌드 모드보다 우선한다", () => {
  assert.equal(
    resolveSentryEnvironment(" staging ", "production"),
    "staging",
  );
  assert.equal(resolveSentryEnvironment("  ", "production"), "production");
});

test("Web Store와 unpacked 확장을 별도 distribution으로 분류한다", () => {
  const storeId = "fmfbhmifnohhfiblebbdjlioppfppbgh";

  assert.equal(resolveSentryDistribution(storeId, storeId), "store");
  assert.equal(
    resolveSentryDistribution("local-extension-id", storeId),
    "unpacked",
  );
  assert.equal(resolveSentryDistribution(undefined, storeId), "unknown");
  assert.equal(resolveSentryDistribution("  ", storeId), "unknown");
});
