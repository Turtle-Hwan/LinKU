import type { ECampusTodoItem } from "@/types/todo";
import { getStorage, setStorage } from "@/utils/chrome";
import { loadECampusTodos } from "@/utils/ecampus/todos";
import { captureErrorLog } from "@/utils/logger";

import { getCustomTodos } from "./customTodo";

const TODO_COUNT_KEY = "todoCount";
const ECAMPUS_TODO_COUNT_KEY = "ecampusTodoCount";

interface TodoCountSnapshot {
  customIncompleteCount: number;
  ecampusCount: number;
}

let countWriteQueue: Promise<void> = Promise.resolve();

const enqueueCountWrite = <T>(write: () => Promise<T>): Promise<T> => {
  const result = countWriteQueue.then(write, write);
  countWriteQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
};

export const loadStoredTodoCount = async (): Promise<number> => {
  return (await getStorage<number>(TODO_COUNT_KEY)) ?? 0;
};

const loadLatestCountSnapshot = async (): Promise<TodoCountSnapshot> => {
  const [customTodos, storedECampusCount, storedTotalCount] =
    await Promise.all([
      getCustomTodos(),
      getStorage<number>(ECAMPUS_TODO_COUNT_KEY),
      loadStoredTodoCount(),
    ]);
  const customIncompleteCount = customTodos.filter(
    (todo) => !todo.completed,
  ).length;

  return {
    customIncompleteCount,
    ecampusCount:
      storedECampusCount ??
      Math.max(0, storedTotalCount - customIncompleteCount),
  };
};

const writeTodoCount = async (
  resolveECampusCount: (snapshot: TodoCountSnapshot) => number,
): Promise<number> => {
  return enqueueCountWrite(async () => {
    const snapshot = await loadLatestCountSnapshot();
    const ecampusCount = Math.max(0, resolveECampusCount(snapshot));
    const totalCount = snapshot.customIncompleteCount + ecampusCount;

    await setStorage({
      [TODO_COUNT_KEY]: totalCount,
      [ECAMPUS_TODO_COUNT_KEY]: ecampusCount,
    });
    return totalCount;
  });
};

/**
 * popup 진입 시 eCampus를 새로 불러오고 전체 count를 갱신한다.
 * 일시 실패는 마지막 정상 eCampus count를 유지하고, 로그인 해제는 0으로 반영한다.
 */
export const refreshTodoCount = async (
  expectedGeneration?: number,
): Promise<number> => {
  try {
    const result = await loadECampusTodos({
      allowAutoLogin: true,
      clearExpiredCredentials: true,
      expectedGeneration,
    });

    return await writeTodoCount((snapshot) => {
      if (result.success) return result.todos.length;
      if (result.needsLogin && !result.superseded) return 0;
      return snapshot.ecampusCount;
    });
  } catch (error) {
    captureErrorLog("[TodoCount] Failed to refresh todo count:", error);
    return loadStoredTodoCount();
  }
};

/**
 * 성공적으로 받은 eCampus 목록과 storage의 최신 custom Todo를 합산한다.
 */
export const syncTodoCountWithECampusTodos = (
  ecampusTodos: ECampusTodoItem[],
): Promise<number> => {
  return writeTodoCount(() => ecampusTodos.length);
};

/**
 * custom Todo 변경 후 마지막 정상 eCampus count를 보존해 다시 합산한다.
 */
export const syncTodoCountAfterCustomChange = (): Promise<number> => {
  return writeTodoCount((snapshot) => snapshot.ecampusCount);
};

/**
 * 로그아웃 또는 계정 교체 시 이전 eCampus count를 제거한다.
 */
export const clearECampusTodoCount = (): Promise<number> => {
  return writeTodoCount(() => 0);
};
