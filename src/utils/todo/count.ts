import { type ECampusTodoItem } from "@/types/todo";
import { loadECampusTodos } from "@/utils/ecampus/todos";
import { setStorage } from "@/utils/chrome";

import { getCustomTodos } from "./customTodo";

interface SyncTodoCountOptions {
  customTodos?: Array<{ completed?: boolean }>;
  ecampusTodos?: ECampusTodoItem[];
}

export const TODO_COUNT_REFRESH_EVENT = "todo-count:refresh";

const loadECampusTodosForCount = async (): Promise<ECampusTodoItem[]> => {
  const result = await loadECampusTodos({
    allowAutoLogin: true,
    clearExpiredCredentials: true,
  });

  return result.success ? result.todos : [];
};

export const syncTodoCount = async (
  options: SyncTodoCountOptions = {}
): Promise<number> => {
  try {
    const customTodos = options.customTodos ?? (await getCustomTodos());
    const ecampusTodos = options.ecampusTodos ?? (await loadECampusTodosForCount());

    const incompleteCustomCount = customTodos.filter((todo) => !todo.completed).length;
    const totalCount = ecampusTodos.length + incompleteCustomCount;

    await setStorage({ todoCount: totalCount });

    return totalCount;
  } catch (error) {
    console.error("[TodoCount] Failed to sync todo count:", error);
    return 0;
  }
};

export const requestTodoCountRefresh = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(TODO_COUNT_REFRESH_EVENT));
};
