import type {
  CreateCustomTodoInput,
  CustomTodoItem,
  ECampusTodoItem,
  TodoItem,
  TodoSortMethod,
} from "@linku/shared-types";

export type TodoLocale = "ko" | "en";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const DEFAULT_DUE_TIME = "23:59";

function readDateParts(value: string) {
  const normalized = value.trim().replace(/-/g, ".");
  const match = normalized.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function normalizeTodoDate(value: string) {
  const parts = readDateParts(value);
  if (!parts) {
    return value.trim().replace(/-/g, ".");
  }

  return [
    parts.year.toString().padStart(4, "0"),
    parts.month.toString().padStart(2, "0"),
    parts.day.toString().padStart(2, "0"),
  ].join(".");
}

export function calculateTodoDDay(dueDate: string, now = new Date()) {
  const parts = readDateParts(dueDate);
  if (!parts) {
    return "D-Day";
  }

  const dueDay = new Date(parts.year, parts.month - 1, parts.day);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (dueDay.getTime() - today.getTime()) / DAY_IN_MILLISECONDS,
  );

  if (diffDays === 0) {
    return "D-Day";
  }

  return diffDays > 0 ? `D-${diffDays}` : `D+${Math.abs(diffDays)}`;
}

export function parseTodoDDay(dDay: string) {
  if (dDay === "D-Day") {
    return 0;
  }

  const match = dDay.match(/^D([+-])(\d+)$/);
  if (!match) {
    return 0;
  }

  const value = Number(match[2]);
  return match[1] === "+" ? -value : value;
}

export function sortTodosByDDay(
  todos: readonly TodoItem[],
  method: TodoSortMethod,
) {
  const direction = method === "dday-asc" ? 1 : -1;

  return [...todos].sort((left, right) => {
    const dDayDifference =
      (parseTodoDDay(left.dDay) - parseTodoDDay(right.dDay)) * direction;

    if (dDayDifference !== 0) {
      return dDayDifference;
    }

    return left.title.localeCompare(right.title);
  });
}

export function format24to12Hour(
  time24: string,
  locale: TodoLocale = "ko",
) {
  const [hourValue, minuteValue] = time24.split(":").map(Number);
  const hour24 = Number.isFinite(hourValue) ? hourValue : 0;
  const minute = Number.isFinite(minuteValue) ? minuteValue : 0;
  const hour12 = hour24 % 12 || 12;
  const formattedMinute = minute.toString().padStart(2, "0");

  if (locale === "en") {
    return `${hour12}:${formattedMinute} ${hour24 < 12 ? "AM" : "PM"}`;
  }

  return `${hour24 < 12 ? "오전" : "오후"} ${hour12}:${formattedMinute}`;
}

export function formatTodoDateTime(
  dueDate: string,
  dueTime: string,
  locale: TodoLocale = "ko",
) {
  return `${normalizeTodoDate(dueDate)} ${format24to12Hour(dueTime, locale)}`;
}

export function buildEcampusLecturePath(
  seq: string,
  gubun: string,
  kj: string,
) {
  const query = new URLSearchParams({ SEQ: seq, gubun, KJKEY: kj });
  return `/ilos/mp/todo_list_connect.acl?${query.toString()}`;
}

export function createCustomTodo(
  input: CreateCustomTodoInput,
  now = Date.now(),
  randomValue = Math.random(),
): CustomTodoItem {
  const dueDate = normalizeTodoDate(input.dueDate);

  return {
    type: "custom",
    id: `custom-${now}-${randomValue.toString(36).slice(2, 11)}`,
    title: input.title.trim(),
    subject: input.subject?.trim() || undefined,
    dDay: calculateTodoDDay(dueDate, new Date(now)),
    dueDate,
    dueTime: input.dueTime || DEFAULT_DUE_TIME,
    completed: false,
    createdAt: now,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStoredCustomTodo(
  value: unknown,
  now: Date,
): CustomTodoItem | null {
  if (!isObject(value)) {
    return null;
  }

  if (
    value.type !== "custom" &&
    value.type !== "personal" &&
    value.type !== undefined
  ) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.dueDate !== "string" ||
    typeof value.completed !== "boolean"
  ) {
    return null;
  }

  const dueDate = normalizeTodoDate(value.dueDate);
  const dueTime =
    typeof value.dueTime === "string" && /^\d{2}:\d{2}$/.test(value.dueTime)
      ? value.dueTime
      : DEFAULT_DUE_TIME;

  return {
    type: "custom",
    id: value.id,
    title: value.title.trim(),
    subject:
      typeof value.subject === "string" && value.subject.trim()
        ? value.subject.trim()
        : undefined,
    dDay: calculateTodoDDay(dueDate, now),
    dueDate,
    dueTime,
    completed: value.completed,
    createdAt:
      typeof value.createdAt === "number" && Number.isFinite(value.createdAt)
        ? value.createdAt
        : now.getTime(),
  };
}

export function normalizeStoredCustomTodos(
  value: unknown,
  now = new Date(),
) {
  if (!Array.isArray(value)) {
    return [] as CustomTodoItem[];
  }

  return value.flatMap((item) => {
    const normalized = normalizeStoredCustomTodo(item, now);
    return normalized ? [normalized] : [];
  });
}

export function toggleCustomTodoInList(
  todos: readonly CustomTodoItem[],
  id: string,
) {
  return todos.map((todo) =>
    todo.id === id ? { ...todo, completed: !todo.completed } : todo,
  );
}

export function deleteCustomTodoFromList(
  todos: readonly CustomTodoItem[],
  id: string,
) {
  return todos.filter((todo) => todo.id !== id);
}

export function updateCustomTodoInList(
  todos: readonly CustomTodoItem[],
  id: string,
  updates: Partial<
    Pick<
      CustomTodoItem,
      "title" | "subject" | "dueDate" | "dueTime" | "completed"
    >
  >,
  now = new Date(),
) {
  return todos.map((todo) => {
    if (todo.id !== id) {
      return todo;
    }

    const dueDate = normalizeTodoDate(updates.dueDate ?? todo.dueDate);
    return {
      ...todo,
      ...updates,
      title: (updates.title ?? todo.title).trim(),
      subject: updates.subject?.trim() || todo.subject,
      dueDate,
      dDay: calculateTodoDDay(dueDate, now),
    };
  });
}

function isEcampusTodo(todo: TodoItem): todo is ECampusTodoItem {
  return todo.type === "ecampus";
}

function isCustomTodo(todo: TodoItem): todo is CustomTodoItem {
  return todo.type === "custom";
}

export function convertTodosToMarkdown(
  todos: readonly TodoItem[],
  locale: TodoLocale = "ko",
) {
  if (todos.length === 0) {
    return locale === "ko" ? "할 일이 없습니다." : "There are no todos.";
  }

  const sections: string[] = [];
  const ecampusTodos = todos.filter(isEcampusTodo);
  const customTodos = todos.filter(isCustomTodo);

  if (ecampusTodos.length > 0) {
    const items = ecampusTodos
      .map(
        (item) =>
          `- [ ] ${item.title}  |  ${item.subject} - ${item.dueDate}`,
      )
      .join("\n");
    sections.push(
      locale === "ko"
        ? `## eCampus Todo\n${items}`
        : `## eCampus todos\n${items}`,
    );
  }

  if (customTodos.length > 0) {
    const items = customTodos
      .map((item) => {
        const checkbox = item.completed ? "x" : " ";
        const subject = item.subject ? `  |  ${item.subject}` : "";
        return `- [${checkbox}] ${item.title}${subject} - ${formatTodoDateTime(
          item.dueDate,
          item.dueTime,
          locale,
        )}`;
      })
      .join("\n");
    sections.push(
      locale === "ko"
        ? `## 나의 Todo\n${items}`
        : `## Personal todos\n${items}`,
    );
  }

  return sections.join("\n\n");
}
