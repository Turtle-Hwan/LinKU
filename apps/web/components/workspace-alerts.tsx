"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button } from "@linku/ui";
import { WORKSPACE_ALERT_CATEGORIES } from "@linku/platform";
import type { AppLocale } from "@/i18n/routing";
import { getWorkspaceCopy } from "@/lib/workspace-copy";

interface WorkspaceAlert {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  href: string;
  publishedAt: string;
}

const FOLLOWED_ALERT_KEY = "linku.web.followed-alerts.v1";

function readFollowedCategories() {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const rawValue = window.localStorage.getItem(FOLLOWED_ALERT_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeFollowedCategories(categories: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FOLLOWED_ALERT_KEY, JSON.stringify(categories));
}

export function WorkspaceAlerts({ locale }: { locale: AppLocale }) {
  const copy = getWorkspaceCopy(locale);
  const [alerts, setAlerts] = useState<WorkspaceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "followed">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [followedCategories, setFollowedCategories] = useState<string[]>([]);

  useEffect(() => {
    setFollowedCategories(readFollowedCategories());
  }, []);

  useEffect(() => {
    let active = true;

    async function loadAlerts() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/alerts");
        if (!response.ok) {
          throw new Error("Failed to load alerts.");
        }

        const data = (await response.json()) as WorkspaceAlert[];
        if (active) {
          setAlerts(data);
        }
      } catch (caughtError) {
        if (active) {
          setError(caughtError instanceof Error ? caughtError.message : "Failed to load alerts.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAlerts();

    return () => {
      active = false;
    };
  }, []);

  const visibleAlerts = useMemo(() => {
    const baseAlerts =
      viewMode === "followed"
        ? alerts.filter((item) => followedCategories.includes(item.category))
        : alerts;

    return categoryFilter === "all"
      ? baseAlerts
      : baseAlerts.filter((item) => item.category === categoryFilter);
  }, [alerts, categoryFilter, followedCategories, viewMode]);

  function toggleFollowedCategory(category: string) {
    const nextCategories = followedCategories.includes(category)
      ? followedCategories.filter((item) => item !== category)
      : [...followedCategories, category];

    setFollowedCategories(nextCategories);
    writeFollowedCategories(nextCategories);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl tracking-[-0.04em]">{copy.alerts.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            {copy.alerts.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={viewMode === "all" ? "default" : "secondary"}
            className="rounded-full"
            onClick={() => setViewMode("all")}
          >
            {copy.alerts.all}
          </Button>
          <Button
            type="button"
            variant={viewMode === "followed" ? "default" : "secondary"}
            className="rounded-full"
            onClick={() => setViewMode("followed")}
          >
            {copy.alerts.followed}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {WORKSPACE_ALERT_CATEGORIES.map((category) => {
          const active = categoryFilter === category.id;
          const followable = category.id !== "all";
          const followed = followedCategories.includes(category.id);

          return (
            <div key={category.id} className="flex items-center gap-2">
              <Badge
                variant={active ? "default" : "outline"}
                className="cursor-pointer px-3 py-2"
                onClick={() => setCategoryFilter(category.id)}
              >
                {category.label[locale]}
              </Badge>
              {followable ? (
                <button
                  type="button"
                  onClick={() => toggleFollowedCategory(category.id)}
                  className="text-xs text-[var(--muted)] underline underline-offset-4"
                >
                  {followed ? copy.alerts.unfollow : copy.alerts.follow}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {loading ? (
        <p className="rounded-[1.2rem] border border-dashed border-black/10 bg-white/70 p-5 text-sm text-[var(--muted)]">
          {copy.alerts.loading}
        </p>
      ) : error ? (
        <p className="rounded-[1.2rem] border border-[#d18d7b] bg-[#fff3ef] p-5 text-sm text-[#8a3d2c]">
          {error}
        </p>
      ) : visibleAlerts.length === 0 ? (
        <p className="rounded-[1.2rem] border border-dashed border-black/10 bg-white/70 p-5 text-sm text-[var(--muted)]">
          {copy.alerts.empty}
        </p>
      ) : (
        <div className="grid gap-4">
          {visibleAlerts.map((alert) => (
            <article
              key={alert.id}
              className="rounded-[1.4rem] border border-black/8 bg-white p-5"
            >
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary">{alert.category}</Badge>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  {copy.alerts.updatedAtPrefix}{" "}
                  {new Date(alert.publishedAt).toLocaleDateString(
                    locale === "ko" ? "ko-KR" : "en-US",
                  )}
                </p>
              </div>
              <h3 className="mt-3 text-2xl tracking-[-0.04em]">{alert.title}</h3>
              {alert.excerpt ? (
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{alert.excerpt}</p>
              ) : null}
              <a
                href={alert.href}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm underline underline-offset-4"
              >
                {locale === "ko" ? "원문 열기" : "Open source"}
              </a>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
