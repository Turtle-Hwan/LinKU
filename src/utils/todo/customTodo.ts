/**
 * 사용자 정의 Todo 관리 유틸리티
 * chrome.storage.local에 사용자 정의 Todo 저장/불러오기/수정/삭제
 */

import { getStorage, setStorage } from "../chrome";
import type { CustomTodoItem } from "@/types/todo";
import { calculateDDay } from "./dateFormat";

const CUSTOM_TODOS_KEY = "customTodos";

/**
 * 모든 사용자 정의 Todo 가져오기
 * 기존 버전의 todo가 있다면 새 형식으로 마이그레이션
 */
export async function getCustomTodos(): Promise<CustomTodoItem[]> {
  const todos = await getStorage<CustomTodoItem[]>(CUSTOM_TODOS_KEY);
  if (!todos || todos.length === 0) {
    return [];
  }

  // 매번 D-Day를 재계산하여 반환
  return todos.map((todo) => {
    // 날짜 형식 정규화: YYYY-MM-DD → YYYY.MM.DD
    const normalizedDate = todo.dueDate.replace(/-/g, ".");

    // 기존 dueDate가 시간을 포함하지 않으면 기본 시간 설정
    const dueTime = todo.dueTime || "23:59";
    // D-Day를 매번 재계산
    const dDay = calculateDDay(normalizedDate, dueTime);

    return {
      ...todo,
      dueDate: normalizedDate,
      dDay,
      dueTime,
      subject: todo.subject || undefined,
    };
  });
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
  const todos = await getCustomTodos();
  const dDay = calculateDDay(dueDate, dueTime);

  const newTodo: CustomTodoItem = {
    type: "custom",
    id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    subject,
    dDay,
    dueDate,
    dueTime,
    completed: false,
    createdAt: Date.now(),
  };

  await setStorage({
    [CUSTOM_TODOS_KEY]: [...todos, newTodo],
  });
}

/**
 * 사용자 정의 Todo 수정
 */
export async function updateCustomTodo(
  id: string,
  updates: Partial<Omit<CustomTodoItem, "id" | "type" | "createdAt">>
): Promise<void> {
  const todos = await getCustomTodos();
  const updatedTodos = todos.map((todo) =>
    todo.id === id ? { ...todo, ...updates } : todo
  );

  await setStorage({
    [CUSTOM_TODOS_KEY]: updatedTodos,
  });
}

/**
 * 사용자 정의 Todo 삭제
 */
export async function deleteCustomTodo(id: string): Promise<void> {
  const todos = await getCustomTodos();
  const filteredTodos = todos.filter((todo) => todo.id !== id);

  await setStorage({
    [CUSTOM_TODOS_KEY]: filteredTodos,
  });
}

/**
 * 사용자 정의 Todo 완료 상태 토글
 */
export async function toggleCustomTodo(id: string): Promise<void> {
  const todos = await getCustomTodos();
  const updatedTodos = todos.map((todo) =>
    todo.id === id ? { ...todo, completed: !todo.completed } : todo
  );

  await setStorage({
    [CUSTOM_TODOS_KEY]: updatedTodos,
  });
}
