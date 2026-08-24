import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createServer, type ViteDevServer } from "vite";

type FailureClassifier = (
  error: unknown,
) => "external_unavailable" | "sync_contract";

let server: ViteDevServer;
let classifyPublicAlertFailure: FailureClassifier;

before(async () => {
  server = await createServer({
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  const module = await server.ssrLoadModule(
    "/src/apis/public-alert-cache.ts",
  );
  classifyPublicAlertFailure = module.classifyPublicAlertFailure;
});

after(async () => {
  await server.close();
});

test("transport and upstream HTTP failures are expected external outages", () => {
  assert.equal(
    classifyPublicAlertFailure(new TypeError("Failed to fetch")),
    "external_unavailable",
  );
  assert.equal(
    classifyPublicAlertFailure(
      new Error("RSS fetch failed for 학사: 503"),
    ),
    "external_unavailable",
  );
  assert.equal(
    classifyPublicAlertFailure(new Error("HTML fetch failed: 403")),
    "external_unavailable",
  );
});

test("empty, malformed, and unstable feeds remain sync-contract failures", () => {
  assert.equal(
    classifyPublicAlertFailure(
      new Error("Alert source returned no usable items for 취창업"),
    ),
    "sync_contract",
  );
  assert.equal(
    classifyPublicAlertFailure(
      new Error("Alert sync boundary not found for 학사"),
    ),
    "sync_contract",
  );
});
