import type { ECampusTodoItem } from "@/types/todo";
import { getStorage, setStorage } from "@/utils/chrome";
import { loadECampusTodos } from "@/utils/ecampus/todos";
import { errorLog } from "@/utils/logger";

import { getCustomTodos } from "./customTodo";

interface SyncTodoCountOptions {
  customTodos?: Array<{ completed?: boolean }>;
  ecampusTodos?: ECampusTodoItem[];
}

const loadECampusTodosForCount = async (): Promise<ECampusTodoItem[]> => {
  const result = await loadECampusTodos({
    allowAutoLogin: true,
    clearExpiredCredentials: true,
  });

  return result.success ? result.todos : [];
};

export const loadStoredTodoCount = async (): Promise<number> => {
  return (await getStorage<number>("todoCount")) ?? 0;
};

export const syncTodoCount = async (
  options: SyncTodoCountOptions = {},
): Promise<number> => {
  try {
    const customTodos = options.customTodos ?? (await getCustomTodos());
    const ecampusTodos =
      options.ecampusTodos ?? (await loadECampusTodosForCount());
    const incompleteCustomCount = customTodos.filter(
      (todo) => !todo.completed,
    ).length;
    const totalCount = ecampusTodos.length + incompleteCustomCount;

    await setStorage({ todoCount: totalCount });
    return totalCount;
  } catch (error) {
    errorLog("[TodoCount] Failed to sync todo count:", error);
    return loadStoredTodoCount();
  }
};
