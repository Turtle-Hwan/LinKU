"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Plus } from "lucide-react";
import {
  convertTodosToMarkdown,
  createCustomTodo,
  formatTodoDateTime,
  normalizeStoredCustomTodos,
  sortTodosByDDay,
} from "@linku/core";
import type {
  CustomTodoItem,
  ECampusTodoItem,
  TodoItem,
  TodoSortMethod,
} from "@linku/shared-types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from "@linku/ui";
import type { AppLocale } from "@/i18n/routing";
import { getWorkspaceCopy } from "@/lib/workspace-copy";
import {
  hasStoredECampusCredentials,
  loadECampusCredentials,
  saveECampusCredentials,
  type SecureCredentials,
} from "@/lib/secure-credentials";

const PERSONAL_TODO_KEY = "linku.web.personal-todos.v1";

function readPersonalTodos() {
  if (typeof window === "undefined") {
    return [] as CustomTodoItem[];
  }

  try {
    const rawValue = window.localStorage.getItem(PERSONAL_TODO_KEY);
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue) as unknown;
    const normalizedTodos = normalizeStoredCustomTodos(parsedValue);

    if (JSON.stringify(parsedValue) !== JSON.stringify(normalizedTodos)) {
      window.localStorage.setItem(
        PERSONAL_TODO_KEY,
        JSON.stringify(normalizedTodos),
      );
    }

    return normalizedTodos;
  } catch {
    return [];
  }
}

function writePersonalTodos(todos: readonly CustomTodoItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PERSONAL_TODO_KEY, JSON.stringify(todos));
}

export function WorkspaceTodos({ locale }: { locale: AppLocale }) {
  const copy = getWorkspaceCopy(locale);
  const [personalTodos, setPersonalTodos] = useState<CustomTodoItem[]>([]);
  const [ecampusTodos, setEcampusTodos] = useState<ECampusTodoItem[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("23:59");
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openSyncDialog, setOpenSyncDialog] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rememberCredentials, setRememberCredentials] = useState(false);
  const [savedCredentials, setSavedCredentials] =
    useState<SecureCredentials | null>(null);
  const [sortMethod, setSortMethod] =
    useState<TodoSortMethod>("dday-desc");

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setPersonalTodos(readPersonalTodos());
      const credentials = await loadECampusCredentials();
      if (cancelled) {
        return;
      }

      setSavedCredentials(credentials);
      setRememberCredentials(hasStoredECampusCredentials());

      if (credentials) {
        setStudentId(credentials.id);
        setPassword(credentials.password);
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  const mergedTodos = useMemo(
    () =>
      sortTodosByDDay(
        [...personalTodos, ...ecampusTodos] satisfies TodoItem[],
        sortMethod,
      ),
    [ecampusTodos, personalTodos, sortMethod],
  );

  function persistPersonalTodos(nextTodos: CustomTodoItem[]) {
    setPersonalTodos(nextTodos);
    writePersonalTodos(nextTodos);
  }

  function addTodo() {
    if (!title.trim() || !dueDate) {
      setError(
        locale === "ko"
          ? "할 일과 마감 날짜를 입력해 주세요."
          : "Enter a todo and due date.",
      );
      return;
    }

    persistPersonalTodos([
      ...personalTodos,
      createCustomTodo({
        title,
        subject,
        dueDate,
        dueTime,
      }),
    ]);
    setTitle("");
    setSubject("");
    setDueDate("");
    setDueTime("23:59");
    setError("");
    setOpenAddDialog(false);
  }

  function toggleTodo(id: string) {
    persistPersonalTodos(
      personalTodos.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item,
      ),
    );
  }

  function removeTodo(id: string) {
    persistPersonalTodos(personalTodos.filter((item) => item.id !== id));
  }

  function toggleSortMethod() {
    setSortMethod((current) =>
      current === "dday-asc" ? "dday-desc" : "dday-asc",
    );
  }

  async function loadEcampusTodos() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const credentials =
        studentId.trim() && password
          ? { id: studentId.trim(), password }
          : savedCredentials;

      if (!credentials?.id || !credentials.password) {
        throw new Error(
          locale === "ko"
            ? "eCampus 계정을 입력하거나 저장된 계정을 불러와 주세요."
            : "Provide eCampus credentials or use a saved account first.",
        );
      }

      const response = await fetch("/api/ecampus/todos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: credentials.id,
          password: credentials.password,
        }),
      });

      const data = (await response.json()) as
        | ECampusTodoItem[]
        | {
            message?: string;
          };

      if (!response.ok) {
        throw new Error(
          "message" in data && data.message
            ? data.message
            : "Failed to load eCampus todos.",
        );
      }

      if (rememberCredentials) {
        await saveECampusCredentials(credentials);
        setSavedCredentials(credentials);
      }

      setEcampusTodos(data as ECampusTodoItem[]);
      setOpenSyncDialog(false);
      setMessage(
        locale === "ko"
          ? "eCampus Todo를 불러왔습니다."
          : "Loaded eCampus todos.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load eCampus todos.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyMarkdown() {
    const markdown = convertTodosToMarkdown(mergedTodos, locale);

    try {
      await navigator.clipboard.writeText(markdown);
      setMessage(
        locale === "ko"
          ? "Todo 목록을 마크다운으로 복사했습니다."
          : "Copied todos as markdown.",
      );
    } catch {
      setMessage(markdown);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{copy.todos.title}</h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={toggleSortMethod}>
            <ArrowUpDown className="size-4" />
            {sortMethod === "dday-asc"
              ? locale === "ko"
                ? "마감 임박순"
                : "Due soon"
              : locale === "ko"
                ? "마감 여유순"
                : "Due later"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void copyMarkdown()}>
            {locale === "ko" ? "복사" : "Copy"}
          </Button>
          <Button type="button" size="sm" onClick={() => setOpenAddDialog(true)}>
            <Plus className="size-4" />
            {copy.todos.addButton}
          </Button>
          <Button type="button" size="sm" onClick={() => setOpenSyncDialog(true)}>
            {copy.todos.syncButton}
          </Button>
        </div>
      </div>

      {message ? (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {mergedTodos.length === 0 ? (
        <Card size="sm">
          <CardContent className="text-sm text-muted-foreground">
            {copy.todos.empty}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {mergedTodos.map((todo) => (
            <Card key={todo.id} size="sm">
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className={`truncate font-medium ${
                        todo.type === "custom" && todo.completed
                          ? "line-through opacity-60"
                          : ""
                      }`}
                    >
                      {todo.title}
                    </h3>
                    <Badge variant={todo.type === "ecampus" ? "default" : "secondary"}>
                      {todo.type === "ecampus"
                        ? copy.todos.ecampusBadge
                        : copy.todos.personalBadge}
                    </Badge>
                    <span className="text-xs font-medium text-primary">
                      {todo.dDay}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {todo.subject ? `${todo.subject} · ` : ""}
                    {todo.type === "custom"
                      ? formatTodoDateTime(todo.dueDate, todo.dueTime, locale)
                      : todo.dueDate}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {todo.type === "ecampus" ? (
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={`https://ecampus.konkuk.ac.kr${todo.lecturePath}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {locale === "ko" ? "강의 열기" : "Open lecture"}
                      </a>
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => toggleTodo(todo.id)}
                      >
                        {todo.completed
                          ? copy.todos.markUndone
                          : copy.todos.markDone}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeTodo(todo.id)}
                      >
                        {copy.todos.remove}
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {locale === "ko" ? "Todo 추가" : "Add todo"}
            </DialogTitle>
            <DialogDescription>
              {locale === "ko"
                ? "확장 프로그램과 같은 형식으로 할 일을 저장합니다."
                : "Save a todo using the same fields as the extension."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={copy.todos.addTitlePlaceholder}
            />
            <Input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={locale === "ko" ? "과목 또는 분류 (선택)" : "Subject (optional)"}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                aria-label={copy.todos.addDateLabel}
              />
              <Input
                type="time"
                value={dueTime}
                onChange={(event) => setDueTime(event.target.value)}
                aria-label={locale === "ko" ? "마감 시간" : "Due time"}
              />
            </div>
            <Button type="button" onClick={addTodo}>
              {copy.todos.addButton}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openSyncDialog} onOpenChange={setOpenSyncDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.todos.syncDialogTitle}</DialogTitle>
            <DialogDescription>{copy.todos.syncDialogBody}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Input
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              placeholder={copy.todos.studentId}
            />
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={copy.todos.password}
            />
            <label className="flex items-center gap-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={rememberCredentials}
                onChange={(event) =>
                  setRememberCredentials(event.target.checked)
                }
              />
              {locale === "ko"
                ? "이 계정을 브라우저에 암호화해 저장"
                : "Save these credentials with browser-side encryption"}
            </label>
            {savedCredentials ? (
              <p className="text-sm text-muted-foreground">
                {locale === "ko"
                  ? "저장된 계정을 불러와 바로 사용할 수 있습니다."
                  : "A saved account is available for quick reuse."}
              </p>
            ) : null}
            <Button
              type="button"
              className="w-full"
              disabled={loading}
              onClick={() => void loadEcampusTodos()}
            >
              {loading
                ? locale === "ko"
                  ? "불러오는 중..."
                  : "Loading..."
                : copy.todos.fetchNow}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
