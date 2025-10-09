/**
 * 사용자 정의 Todo 관리 유틸리티
 * chrome.storage.local에 사용자 정의 Todo 저장/불러오기/수정/삭제
 */

import { getStorage, setStorage } from "./chrome";
import { CustomTodoItem } from "@/types/todo";

const CUSTOM_TODOS_KEY = "customTodos";

/**
 * 모든 사용자 정의 Todo 가져오기
 */
export async function getCustomTodos(): Promise<CustomTodoItem[]> {
  try {
    const todos = await getStorage<CustomTodoItem[]>(CUSTOM_TODOS_KEY);
    return todos || [];
  } catch (error) {
    console.error("[CustomTodo] Error getting custom todos:", error);
    return [];
  }
}

/**
 * 새 사용자 정의 Todo 추가
 */
export async function addCustomTodo(
  title: string,
  dueDate: string
): Promise<void> {
  try {
    const todos = await getCustomTodos();
    const newTodo: CustomTodoItem = {
      type: 'custom',
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      dueDate,
      completed: false,
      createdAt: Date.now(),
    };

    await setStorage({
      [CUSTOM_TODOS_KEY]: [...todos, newTodo],
    });
  } catch (error) {
    console.error("[CustomTodo] Error adding custom todo:", error);
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
    const updatedTodos = todos.map((todo) =>
      todo.id === id ? { ...todo, ...updates } : todo
    );

    await setStorage({
      [CUSTOM_TODOS_KEY]: updatedTodos,
    });
  } catch (error) {
    console.error("[CustomTodo] Error updating custom todo:", error);
    throw error;
  }
}

/**
 * 사용자 정의 Todo 삭제
 */
export async function deleteCustomTodo(id: string): Promise<void> {
  try {
    const todos = await getCustomTodos();
    const filteredTodos = todos.filter((todo) => todo.id !== id);

    await setStorage({
      [CUSTOM_TODOS_KEY]: filteredTodos,
    });
  } catch (error) {
    console.error("[CustomTodo] Error deleting custom todo:", error);
    throw error;
  }
}

/**
 * 사용자 정의 Todo 완료 상태 토글
 */
export async function toggleCustomTodo(id: string): Promise<void> {
  try {
    const todos = await getCustomTodos();
    const updatedTodos = todos.map((todo) =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );

    await setStorage({
      [CUSTOM_TODOS_KEY]: updatedTodos,
    });
  } catch (error) {
    console.error("[CustomTodo] Error toggling custom todo:", error);
    throw error;
  }
}
