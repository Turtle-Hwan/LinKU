import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useToast } from "../../src/components/ui/use-toast.ts";

test("템플릿 목록의 toast API 참조는 다시 렌더링해도 바뀌지 않는다", () => {
  const references: Array<ReturnType<typeof useToast>["toast"]> = [];

  function ToastProbe() {
    references.push(useToast().toast);
    return null;
  }

  renderToString(createElement(ToastProbe));
  renderToString(createElement(ToastProbe));

  assert.equal(references.length, 2);
  assert.equal(references[0], references[1]);
});
