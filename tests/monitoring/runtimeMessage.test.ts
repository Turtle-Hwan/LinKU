import assert from "node:assert/strict";
import test from "node:test";

import { createMonitoringReporter } from "../../src/monitoring/reporter.ts";
import {
  createRuntimeMessageResponder,
  getRuntimeMessageType,
} from "../../src/monitoring/runtimeMessage.ts";
import { createCollector } from "./testCollector.ts";

test("runtime responder는 첫 응답만 보내고 중복과 전송 실패를 수집한다", () => {
  const { collector, calls } = createCollector();
  const reporter = createMonitoringReporter(collector);
  const responses: unknown[] = [];
  const respond = createRuntimeMessageResponder(reporter, {
    runtime: "background",
    messageType: "LINKU_TEST",
    sendResponse(response) {
      responses.push(response);
    },
  });

  respond({ success: true });
  respond({ success: false, error: "duplicate" });

  assert.deepEqual(responses, [{ success: true }]);
  assert.deepEqual(calls.breadcrumbs[0], {
    category: "background.message",
    message: "response sent",
    data: {
      message_type: "LINKU_TEST",
      success: true,
      has_error: false,
    },
    level: "info",
  });
  assert.equal(
    calls.messages[0]?.context?.feature,
    "runtime_message_response_duplicate",
  );

  const failedRespond = createRuntimeMessageResponder(reporter, {
    runtime: "content",
    messageType: "LINKU_FAIL",
    sendResponse() {
      throw new Error("port closed");
    },
  });
  failedRespond({ success: false });

  assert.equal(
    calls.exceptions[0]?.context?.feature,
    "runtime_message_response",
  );
  assert.equal(
    calls.exceptions[0]?.context?.mechanism,
    "runtime.sendResponse",
  );
  assert.equal(getRuntimeMessageType({ type: "LINKU_TEST" }), "LINKU_TEST");
  assert.equal(getRuntimeMessageType({ type: 1 }), "invalid");
});
