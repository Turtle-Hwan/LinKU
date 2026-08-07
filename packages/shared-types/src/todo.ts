export type TodoSortMethod = "dday-asc" | "dday-desc";

export interface ECampusTodoItem {
  type: "ecampus";
  id: string;
  title: string;
  subject: string;
  dDay: string;
  dueDate: string;
  lecturePath: string;
  kj: string;
  gubun: string;
  seq: string;
}

export interface CustomTodoItem {
  type: "custom";
  id: string;
  title: string;
  subject?: string;
  dDay: string;
  dueDate: string;
  dueTime: string;
  completed: boolean;
  createdAt: number;
}

export type TodoItem = ECampusTodoItem | CustomTodoItem;

export interface CreateCustomTodoInput {
  title: string;
  subject?: string;
  dueDate: string;
  dueTime?: string;
}
