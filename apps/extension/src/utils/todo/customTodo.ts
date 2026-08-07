/**
 * 사용자 정의 Todo 관리 유틸리티
 * chrome.storage.local에 사용자 정의 Todo 저장/불러오기/수정/삭제
 */

import { getStorage, setStorage } from "../chrome";
import type { CustomTodoItem } from "@/types/todo";
import {
  createCustomTodo,
  deleteCustomTodoFromList,
  normalizeStoredCustomTodos,
  toggleCustomTodoInList,
  updateCustomTodoInList,
} from "@linku/core";
import { errorLog } from '@/utils/logger';

const CUSTOM_TODOS_KEY = "customTodos";

/**
 * 모든 사용자 정의 Todo 가져오기
 * 기존 버전의 todo가 있다면 새 형식으로 마이그레이션
 */
export async function getCustomTodos(): Promise<CustomTodoItem[]> {
  try {
    const storedTodos = await getStorage<unknown>(CUSTOM_TODOS_KEY);
    if (!storedTodos) {
      return [];
    }

    const normalizedTodos = normalizeStoredCustomTodos(storedTodos);
    if (JSON.stringify(storedTodos) !== JSON.stringify(normalizedTodos)) {
      await setStorage({
        [CUSTOM_TODOS_KEY]: normalizedTodos,
      });
    }

    return normalizedTodos;
  } catch (error) {
    errorLog("[CustomTodo] Error getting custom todos:", error);
    return [];
  }
}

/**
 * 새 사용자 정의 Todo 추가
 */
export async function addCustomTodo(
  title: string,
  dueDate: string,
  dueTime: string,
  subject?: string
): Promise<void> {
  try {
    const todos = await getCustomTodos();
    const newTodo = createCustomTodo({
      title,
      subject,
      dueDate,
      dueTime,
    });

    await setStorage({
      [CUSTOM_TODOS_KEY]: [...todos, newTodo],
    });
  } catch (error) {
    errorLog("[CustomTodo] Error adding custom todo:", error);
    throw error;
  }
}

/**
 * 사용자 정의 Todo 수정
 */
export async function updateCustomTodo(
  id: string,
  updates: Partial<Omit<CustomTodoItem, "id" | "type" | "createdAt">>
): Promise<void> {
  try {
    const todos = await getCustomTodos();
    const updatedTodos = updateCustomTodoInList(todos, id, updates);

    await setStorage({
      [CUSTOM_TODOS_KEY]: updatedTodos,
    });
  } catch (error) {
    errorLog("[CustomTodo] Error updating custom todo:", error);
    throw error;
  }
}

/**
 * 사용자 정의 Todo 삭제
 */
export async function deleteCustomTodo(id: string): Promise<void> {
  try {
    const todos = await getCustomTodos();
    const filteredTodos = deleteCustomTodoFromList(todos, id);

    await setStorage({
      [CUSTOM_TODOS_KEY]: filteredTodos,
    });
  } catch (error) {
    errorLog("[CustomTodo] Error deleting custom todo:", error);
    throw error;
  }
}

/**
 * 사용자 정의 Todo 완료 상태 토글
 */
export async function toggleCustomTodo(id: string): Promise<void> {
  try {
    const todos = await getCustomTodos();
    const updatedTodos = toggleCustomTodoInList(todos, id);

    await setStorage({
      [CUSTOM_TODOS_KEY]: updatedTodos,
    });
  } catch (error) {
    errorLog("[CustomTodo] Error toggling custom todo:", error);
    throw error;
  }
}
