import assert from "node:assert/strict";
import test from "node:test";

import * as Sentry from "@sentry/browser";
import type { ErrorEvent as SentryErrorEvent } from "@sentry/browser";

import { scrubSentryEvent } from "../../src/monitoring/scrubber.ts";
import type { MonitoringRuntime } from "../../src/monitoring/types.ts";

type CapturedEnvelope = [
  unknown,
  Array<[unknown, SentryErrorEvent]>,
];

test("custom transport envelope가 runtime, release, environment와 Debug ID를 보존한다", async () => {
  const debugId = "12345678-1234-4234-8234-123456789abc";
  const runtimeGlobal = globalThis as typeof globalThis & {
    _sentryDebugIds?: Record<string, string>;
  };
  const previousDebugIds = runtimeGlobal._sentryDebugIds;
  const injectionStack = new Error().stack;
  assert.ok(injectionStack);
  runtimeGlobal._sentryDebugIds = { [injectionStack]: debugId };

  const envelopes: CapturedEnvelope[] = [];

  try {
    Sentry.init({
      dsn: "https://public@example.invalid/1",
      release: "linku@test-envelope",
      environment: "production",
      sendDefaultPii: false,
      beforeSend: scrubSentryEvent,
      transport: () => ({
        async send(envelope) {
          envelopes.push(envelope as CapturedEnvelope);
          return {};
        },
        async flush() {
          return true;
        },
      }),
    });

    const runtimes: MonitoringRuntime[] = ["popup", "background", "content"];
    runtimes.forEach((runtime) => {
      Sentry.withScope((scope) => {
        scope.setTag("linku_runtime", runtime);
        scope.setUser({ email: `${runtime}@example.com` });
        Sentry.captureException(new Error(`envelope smoke: ${runtime}`));
      });
    });

    assert.equal(await Sentry.flush(1_000), true);
    assert.equal(envelopes.length, 3);

    const events = envelopes.map((envelope) => envelope[1][0]?.[1]);
    assert.deepEqual(
      events.map((event) => event?.tags?.linku_runtime),
      runtimes,
    );

    events.forEach((event) => {
      assert.equal(event?.release, "linku@test-envelope");
      assert.equal(event?.environment, "production");
      assert.equal(event?.user, undefined);
      assert.ok(
        event?.debug_meta?.images?.some(
          (image) => image.type === "sourcemap" && image.debug_id === debugId,
        ),
      );
    });
  } finally {
    await Sentry.close(1_000);
    runtimeGlobal._sentryDebugIds = previousDebugIds;
  }
});
