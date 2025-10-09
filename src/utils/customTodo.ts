/**
 * 사용자 정의 Todo 관리 유틸리티
 * chrome.storage.local에 사용자 정의 Todo 저장/불러오기/수정/삭제
 */

import { getStorage, setStorage } from "./chrome";
import { CustomTodoItem } from "@/types/todo";

const CUSTOM_TODOS_KEY = "customTodos";

/**
 * D-Day 계산 함수
 * @param dueDate 마감 날짜 (YYYY.MM.DD 또는 YYYY-MM-DD 형식)
 * @param _dueTime 마감 시간 (HH:mm 형식) - D-Day 계산에는 사용하지 않음 (자정 기준)
 * @returns D-Day 문자열 (예: "D-3", "D-Day", "D+2")
 */
function calculateDDay(dueDate: string, _dueTime: string): string {
  try {
    // 날짜 형식 정규화: YYYY-MM-DD → YYYY.MM.DD
    const normalizedDate = dueDate.replace(/-/g, ".");
    const [year, month, day] = normalizedDate.split(".").map(Number);

    // 유효성 검사
    if (!year || !month || !day) {
      console.error(`[calculateDDay] Invalid date format: ${dueDate}`);
      return "D-Day";
    }

    // 자정 기준으로 날짜 차이 계산
    const dueDay = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = dueDay.getTime() - today.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "D-Day";
    } else if (diffDays > 0) {
      return `D-${diffDays}`;
    } else {
      return `D+${Math.abs(diffDays)}`;
    }
  } catch (error) {
    console.error(`[calculateDDay] Error calculating D-Day:`, error);
    return "D-Day";
  }
}

/**
 * 모든 사용자 정의 Todo 가져오기
 * 기존 버전의 todo가 있다면 새 형식으로 마이그레이션
 */
export async function getCustomTodos(): Promise<CustomTodoItem[]> {
  try {
    const todos = await getStorage<CustomTodoItem[]>(CUSTOM_TODOS_KEY);
    if (!todos || todos.length === 0) {
      return [];
    }

    // 마이그레이션: 기존 todo에 새 필드가 없다면 추가
    let needsMigration = false;
    const migratedTodos = todos.map((todo) => {
      // 새 필드가 이미 있다면 그대로 반환
      if (todo.dDay && todo.dueTime && todo.dueDate.includes(".")) {
        return todo;
      }

      needsMigration = true;

      // 날짜 형식 정규화: YYYY-MM-DD → YYYY.MM.DD
      const normalizedDate = todo.dueDate.replace(/-/g, ".");

      // 기존 dueDate가 시간을 포함하지 않으면 기본 시간 설정
      const dueTime = todo.dueTime || "23:59";
      const dDay = calculateDDay(normalizedDate, dueTime);

      return {
        ...todo,
        dueDate: normalizedDate,
        dDay,
        dueTime,
        subject: todo.subject || undefined,
      };
    });

    // 마이그레이션이 필요했다면 저장
    if (needsMigration) {
      await setStorage({
        [CUSTOM_TODOS_KEY]: migratedTodos,
      });
    }

    return migratedTodos;
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
  dueDate: string,
  dueTime: string,
  subject?: string
): Promise<void> {
  try {
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
