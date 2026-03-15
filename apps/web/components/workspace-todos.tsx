"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
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

interface PersonalTodoItem {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
  type: "personal";
}

interface EcampusTodoItem {
  id: string;
  title: string;
  subject: string;
  dDay: string;
  dueDate: string;
  lecturePath: string;
  type: "ecampus";
}

type WorkspaceTodoItem = PersonalTodoItem | EcampusTodoItem;

const PERSONAL_TODO_KEY = "linku.web.personal-todos.v1";

function readPersonalTodos() {
  if (typeof window === "undefined") {
    return [] as PersonalTodoItem[];
  }

  try {
    const rawValue = window.localStorage.getItem(PERSONAL_TODO_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is PersonalTodoItem =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as PersonalTodoItem).id === "string" &&
            typeof (item as PersonalTodoItem).title === "string" &&
            typeof (item as PersonalTodoItem).dueDate === "string" &&
            typeof (item as PersonalTodoItem).completed === "boolean",
        )
      : [];
  } catch {
    return [];
  }
}

function writePersonalTodos(todos: PersonalTodoItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PERSONAL_TODO_KEY, JSON.stringify(todos));
}

function compareTodoDates(left: WorkspaceTodoItem, right: WorkspaceTodoItem) {
  const leftDate = new Date(left.dueDate).getTime();
  const rightDate = new Date(right.dueDate).getTime();
  return leftDate - rightDate;
}

function convertTodosToMarkdown(todos: WorkspaceTodoItem[], locale: AppLocale) {
  if (todos.length === 0) {
    return locale === "ko" ? "할 일이 없습니다." : "There are no todos.";
  }

  const ecampusTodos = todos.filter(
    (todo): todo is EcampusTodoItem => todo.type === "ecampus",
  );
  const personalTodos = todos.filter(
    (todo): todo is PersonalTodoItem => todo.type === "personal",
  );
  const sections: string[] = [];

  if (ecampusTodos.length > 0) {
    const items = ecampusTodos
      .map((item) => `- [ ] ${item.title} | ${item.subject} | ${item.dueDate}`)
      .join("\n");
    sections.push(
      locale === "ko" ? `## eCampus Todo\n${items}` : `## eCampus todos\n${items}`,
    );
  }

  if (personalTodos.length > 0) {
    const items = personalTodos
      .map(
        (item) =>
          `- [${item.completed ? "x" : " "}] ${item.title} - ${item.dueDate}`,
      )
      .join("\n");
    sections.push(
      locale === "ko" ? `## 개인 Todo\n${items}` : `## Personal todos\n${items}`,
    );
  }

  return sections.join("\n\n");
}

export function WorkspaceTodos({ locale }: { locale: AppLocale }) {
  const copy = getWorkspaceCopy(locale);
  const [personalTodos, setPersonalTodos] = useState<PersonalTodoItem[]>([]);
  const [ecampusTodos, setEcampusTodos] = useState<EcampusTodoItem[]>([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rememberCredentials, setRememberCredentials] = useState(false);
  const [savedCredentials, setSavedCredentials] = useState<SecureCredentials | null>(null);

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
    () => [...personalTodos, ...ecampusTodos].sort(compareTodoDates),
    [ecampusTodos, personalTodos],
  );

  function addTodo() {
    if (!title.trim() || !dueDate) {
      return;
    }

    const nextTodos = [
      ...personalTodos,
      {
        id: `todo-${Date.now()}`,
        title: title.trim(),
        dueDate,
        completed: false,
        type: "personal" as const,
      },
    ];

    setPersonalTodos(nextTodos);
    writePersonalTodos(nextTodos);
    setTitle("");
    setDueDate("");
  }

  function toggleTodo(id: string) {
    const nextTodos = personalTodos.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item,
    );
    setPersonalTodos(nextTodos);
    writePersonalTodos(nextTodos);
  }

  function removeTodo(id: string) {
    const nextTodos = personalTodos.filter((item) => item.id !== id);
    setPersonalTodos(nextTodos);
    writePersonalTodos(nextTodos);
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
        body: JSON.stringify({ userId: credentials.id, password: credentials.password }),
      });

      const data = (await response.json()) as
        | EcampusTodoItem[]
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

      setEcampusTodos(
        (data as EcampusTodoItem[]).map((item) => ({ ...item, type: "ecampus" })),
      );
      setOpenDialog(false);
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl tracking-[-0.04em]">{copy.todos.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            {copy.todos.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => void copyMarkdown()}>
            {locale === "ko" ? "마크다운 복사" : "Copy markdown"}
          </Button>
          <Button
            type="button"
            className="rounded-full"
            onClick={() => setOpenDialog(true)}
          >
            {copy.todos.syncButton}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={copy.todos.addTitlePlaceholder}
          className="rounded-full bg-white"
        />
        <Input
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          aria-label={copy.todos.addDateLabel}
          className="rounded-full bg-white"
        />
        <Button type="button" onClick={addTodo} className="rounded-full">
          {copy.todos.addButton}
        </Button>
      </div>

      {message ? (
        <p className="rounded-[1.2rem] border border-[#b0c38f] bg-[#eff8df] p-4 text-sm text-[#30411e]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-[1.2rem] border border-[#d18d7b] bg-[#fff3ef] p-4 text-sm text-[#8a3d2c]">
          {error}
        </p>
      ) : null}

      {mergedTodos.length === 0 ? (
        <p className="rounded-[1.2rem] border border-dashed border-black/15 bg-white/70 p-5 text-sm leading-7 text-[var(--muted)]">
          {copy.todos.empty}
        </p>
      ) : (
        <div className="grid gap-4">
          {mergedTodos.map((todo) => (
            <article
              key={todo.id}
              className="flex flex-col gap-4 rounded-[1.4rem] border border-black/8 bg-white p-5 lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    className={`text-xl tracking-[-0.03em] ${
                      "completed" in todo && todo.completed
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
                </div>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  {"subject" in todo && todo.subject ? `${todo.subject} · ` : ""}
                  {"dDay" in todo && todo.dDay ? `${todo.dDay} · ` : ""}
                  {todo.dueDate}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {todo.type === "ecampus" ? (
                  <a
                    href={`https://ecampus.konkuk.ac.kr${todo.lecturePath}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-black/10 px-4 py-2 text-sm"
                  >
                    {locale === "ko" ? "강의 열기" : "Open lecture"}
                  </a>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-full"
                      onClick={() => toggleTodo(todo.id)}
                    >
                      {todo.completed ? copy.todos.markUndone : copy.todos.markDone}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => removeTodo(todo.id)}
                    >
                      {copy.todos.remove}
                    </Button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.todos.syncDialogTitle}</DialogTitle>
            <DialogDescription>{copy.todos.syncDialogBody}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
            <label className="flex items-center gap-3 text-sm text-[var(--muted)]">
              <input
                type="checkbox"
                checked={rememberCredentials}
                onChange={(event) => setRememberCredentials(event.target.checked)}
              />
              {locale === "ko"
                ? "이 계정을 브라우저에 암호화해 저장"
                : "Save these credentials with browser-side encryption"}
            </label>
            {savedCredentials ? (
              <p className="text-sm text-[var(--muted)]">
                {locale === "ko"
                  ? "저장된 계정을 불러와 바로 사용할 수 있습니다."
                  : "A saved account is available for quick reuse."}
              </p>
            ) : null}
            <Button
              type="button"
              className="w-full rounded-full"
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
