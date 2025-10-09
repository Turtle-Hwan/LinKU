import { TodoItem } from "@/apis/eCampusAPI";

/**
 * Todo 항목들을 마크다운 체크리스트 형식으로 변환합니다.
 *
 * @param todos - 변환할 Todo 항목 배열
 * @returns 마크다운 형식의 문자열
 *
 * @example
 * ```typescript
 * const todos = [
 *   { title: "과제 제출", subject: "프로그래밍", dueDate: "2024-03-20", dDay: "D-3" }
 * ];
 *
 * convertTodosToMarkdown(todos);
 * // "- [ ] 과제 제출  |  프로그래밍 - 2024-03-20"
 * ```
 */
export const convertTodosToMarkdown = (todos: TodoItem[]): string => {
  if (todos.length === 0) {
    return "할 일이 없습니다.";
  }

  return todos
    .map((item) => `- [ ] ${item.title}  |  ${item.subject} - ${item.dueDate}`)
    .join("\n");
};
