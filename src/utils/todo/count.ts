import { eCampusLoginAPI, eCampusTodoListAPI } from "@/apis";
import { type ECampusTodoItem } from "@/types/todo";
import { setStorage } from "@/utils/chrome";
import { loadECampusCredentials } from "@/utils/credentials";

import { getCustomTodos } from "./customTodo";

interface SyncTodoCountOptions {
  customTodos?: Array<{ completed?: boolean }>;
  ecampusTodos?: ECampusTodoItem[];
}

const loadECampusTodosForCount = async (): Promise<ECampusTodoItem[]> => {
  try {
    const initialResult = await eCampusTodoListAPI();
    if (initialResult.success && initialResult.data?.todoList) {
      return initialResult.data.todoList;
    }

    if (!initialResult.needLogin) {
      return [];
    }

    const credentials = await loadECampusCredentials();
    if (!credentials) {
      return [];
    }

    const loginResult = await eCampusLoginAPI(credentials.id, credentials.password);
    if (!loginResult.success) {
      return [];
    }

    const todoResult = await eCampusTodoListAPI();
    if (todoResult.success && todoResult.data?.todoList) {
      return todoResult.data.todoList;
    }

    return [];
  } catch (error) {
    console.error("[TodoCount] Failed to load eCampus todos:", error);
    return [];
  }
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
