import assert from "node:assert/strict";
import test from "node:test";

import { resolveECampusTodosAfterLoad } from "../../src/utils/ecampus/todoState.ts";

test("일시 eCampus 오류에는 마지막 정상 목록을 보존한다", () => {
  const previousTodos = [{ id: "ecampus-1" }];

  assert.deepEqual(
    resolveECampusTodosAfterLoad(previousTodos, {
      success: false,
      todos: [],
    }),
    previousTodos,
  );
});

test("로그인이 필요한 응답에는 eCampus 목록을 비운다", () => {
  assert.deepEqual(
    resolveECampusTodosAfterLoad([{ id: "ecampus-1" }], {
      success: false,
      todos: [],
      needsLogin: true,
    }),
    [],
  );
});
