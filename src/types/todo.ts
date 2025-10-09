/**
 * Todo 아이템 타입 정의
 * Discriminated Union 패턴 사용
 */

// 이캠퍼스 Todo
export interface ECampusTodoItem {
  type: "ecampus";
  id: string;
  title: string;
  subject: string;
  dDay: string;
  dueDate: string;
  kj: string;
  gubun: string;
  seq: string;
}

// 사용자 정의 Todo
export interface CustomTodoItem {
  type: "custom";
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
  createdAt: number;
}

export type TodoItem = ECampusTodoItem | CustomTodoItem;
