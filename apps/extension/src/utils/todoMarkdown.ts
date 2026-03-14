import { TodoItem } from "@/types/todo";
import { formatTodoDateTime } from "./todo/dateFormat";

/**
 * Todo 항목들을 마크다운 체크리스트 형식으로 변환합니다.
 *
 * @param todos - 변환할 Todo 항목 배열
 * @returns 마크다운 형식의 문자열
 *
 * @example
 * ```typescript
 * const todos = [
 *   { type: 'ecampus', title: "과제 제출", subject: "프로그래밍", dueDate: "2024.03.20 오후 11:59", dDay: "D-3" },
 *   { type: 'custom', title: "책 읽기", dueDate: "2024.03.25", dueTime: "23:59", completed: false }
 * ];
 *
 * convertTodosToMarkdown(todos);
 * // "## 이캠퍼스 Todo\n- [ ] 과제 제출  |  프로그래밍 - 2024.03.20 오후 11:59\n\n## 나의 Todo\n- [ ] 책 읽기 - 2024.03.25 오후 11:59"
 * ```
 */
export const convertTodosToMarkdown = (todos: TodoItem[]): string => {
  if (todos.length === 0) {
    return "할 일이 없습니다.";
  }

  // 이캠퍼스 Todo와 사용자 정의 Todo 분리
  const ecampusTodos = todos.filter((todo) => todo.type === "ecampus");
  const customTodos = todos.filter((todo) => todo.type === "custom");

  const sections: string[] = [];

  // 이캠퍼스 Todo 섹션
  if (ecampusTodos.length > 0) {
    const ecampusMarkdown = ecampusTodos
      .map(
        (item) => `- [ ] ${item.title}  |  ${item.subject} - ${item.dueDate}`
      )
      .join("\n");
    sections.push(`## 이캠퍼스 Todo\n${ecampusMarkdown}`);
  }

  // 사용자 정의 Todo 섹션
  if (customTodos.length > 0) {
    const customMarkdown = customTodos
      .map((item) => {
        const formattedDateTime = formatTodoDateTime(
          item.dueDate,
          item.dueTime
        );
        const checkbox = item.completed ? "x" : " ";
        const subjectPart = item.subject ? `  |  ${item.subject}` : "";
        return `- [${checkbox}] ${item.title}${subjectPart} - ${formattedDateTime}`;
      })
      .join("\n");
    sections.push(`## 나의 Todo\n${customMarkdown}`);
  }

  return sections.join("\n\n");
};
