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

  useEffect(() => {
    setPersonalTodos(readPersonalTodos());
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

    try {
      const response = await fetch("/api/ecampus/todos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: studentId, password }),
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

      setEcampusTodos(
        (data as EcampusTodoItem[]).map((item) => ({ ...item, type: "ecampus" })),
      );
      setOpenDialog(false);
      setPassword("");
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl tracking-[-0.04em]">{copy.todos.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            {copy.todos.description}
          </p>
        </div>
        <Button
          type="button"
          className="rounded-full"
          onClick={() => setOpenDialog(true)}
        >
          {copy.todos.syncButton}
        </Button>
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
                      {todo.completed
                        ? copy.todos.markUndone
                        : copy.todos.markDone}
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
            <Button
              type="button"
              className="w-full rounded-full"
              disabled={loading}
              onClick={loadEcampusTodos}
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
