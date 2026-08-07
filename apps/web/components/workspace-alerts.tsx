"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@linku/ui";
import { Bell, Loader2, Search, X } from "lucide-react";
import type {
  Department,
  GeneralAlert,
  Subscription,
  WorkspaceAlertItem,
} from "@linku/shared-types";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getWorkspaceCopy } from "@/lib/workspace-copy";

interface SubscriptionSnapshot {
  configured: boolean;
  connected: boolean;
  mode: "disconnected" | "guest" | "member";
  kuMail?: string;
  departments: Department[];
  subscriptions: Subscription[];
  message?: string;
}

interface MyAlertsSnapshot {
  configured: boolean;
  connected: boolean;
  mode: "disconnected" | "guest" | "member";
  alerts: GeneralAlert[];
  message?: string;
}

const FOLLOWED_ALERT_KEY = "linku.web.followed-alerts.v1";
const ALERT_PAGE_SIZE = 12;

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

function sortAlertsByDate<T extends { publishedAt: string }>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
  );
}

export function WorkspaceAlerts({ locale }: { locale: AppLocale }) {
  const copy = getWorkspaceCopy(locale);
  const [alerts, setAlerts] = useState<WorkspaceAlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "followed">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [visibleAlertCount, setVisibleAlertCount] = useState(ALERT_PAGE_SIZE);
  const [followedCategories, setFollowedCategories] = useState<string[]>([]);
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionSnapshot>({
    configured: false,
    connected: false,
    mode: "disconnected",
    departments: [],
    subscriptions: [],
  });
  const [departmentAlerts, setDepartmentAlerts] = useState<GeneralAlert[]>([]);
  const [departmentMessage, setDepartmentMessage] = useState("");
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [departmentActionPending, setDepartmentActionPending] = useState(false);
  const [openDepartmentPicker, setOpenDepartmentPicker] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setFollowedCategories(readFollowedCategories()),
      0,
    );

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadPublicAlerts() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/alerts");
        if (!response.ok) {
          throw new Error("Failed to load alerts.");
        }

        const data = (await response.json()) as WorkspaceAlertItem[];
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

    async function loadDepartmentAlerts() {
      setLoadingDepartments(true);
      setDepartmentMessage("");

      try {
        const subscriptionsResponse = await fetch("/api/alerts/subscriptions");
        const subscriptionsData = (await subscriptionsResponse.json()) as SubscriptionSnapshot;

        if (!active) {
          return;
        }

        setSubscriptionState(subscriptionsData);
        setDepartmentMessage(subscriptionsData.message || "");

        if (
          subscriptionsData.connected &&
          subscriptionsData.mode === "member"
        ) {
          const myAlertsResponse = await fetch("/api/alerts/my");
          const myAlertsData = (await myAlertsResponse.json()) as MyAlertsSnapshot;

          if (!active) {
            return;
          }

          setDepartmentAlerts(sortAlertsByDate(myAlertsData.alerts));
          if (myAlertsData.message) {
            setDepartmentMessage(myAlertsData.message);
          }
        } else {
          setDepartmentAlerts([]);
        }
      } catch (caughtError) {
        if (active) {
          setDepartmentMessage(
            caughtError instanceof Error
              ? caughtError.message
              : "Failed to load department alerts.",
          );
        }
      } finally {
        if (active) {
          setLoadingDepartments(false);
        }
      }
    }

    void Promise.all([loadPublicAlerts(), loadDepartmentAlerts()]);

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

  const visibleCategories = useMemo(() => {
    const categories = new Set<string>(["all"]);
    alerts.forEach((item) => categories.add(item.category));
    return [...categories];
  }, [alerts]);

  const pagedAlerts = useMemo(
    () => visibleAlerts.slice(0, visibleAlertCount),
    [visibleAlertCount, visibleAlerts],
  );

  const availableDepartments = useMemo(
    () =>
      subscriptionState.departments.filter(
        (department) =>
          !subscriptionState.subscriptions.some(
            (subscription) => subscription.department.id === department.id,
          ),
      ),
    [subscriptionState.departments, subscriptionState.subscriptions],
  );

  function toggleFollowedCategory(category: string) {
    const nextCategories = followedCategories.includes(category)
      ? followedCategories.filter((item) => item !== category)
      : [...followedCategories, category];

    setFollowedCategories(nextCategories);
    writeFollowedCategories(nextCategories);
  }

  async function refreshDepartmentState(message?: string) {
    setDepartmentActionPending(true);

    try {
      const [subscriptionsResponse, myAlertsResponse] = await Promise.all([
        fetch("/api/alerts/subscriptions"),
        fetch("/api/alerts/my"),
      ]);
      const subscriptionsData = (await subscriptionsResponse.json()) as SubscriptionSnapshot;
      const myAlertsData = (await myAlertsResponse.json()) as MyAlertsSnapshot;

      setSubscriptionState(subscriptionsData);
      setDepartmentAlerts(sortAlertsByDate(myAlertsData.alerts));
      setDepartmentMessage(
        myAlertsData.message || subscriptionsData.message || message || "",
      );
    } finally {
      setDepartmentActionPending(false);
    }
  }

  async function subscribeDepartment(departmentId: number) {
    setDepartmentActionPending(true);

    try {
      const response = await fetch("/api/alerts/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ departmentId }),
      });
      const data = (await response.json()) as SubscriptionSnapshot;

      setSubscriptionState(data);
      setDepartmentMessage(
        data.message ||
          (locale === "ko"
            ? "학과 구독을 추가했습니다."
            : "The department subscription has been added."),
      );

      if (response.ok) {
        await refreshDepartmentState();
      }
    } finally {
      setOpenDepartmentPicker(false);
      setDepartmentActionPending(false);
    }
  }

  async function unsubscribeDepartment(departmentId: number) {
    setDepartmentActionPending(true);

    try {
      const response = await fetch("/api/alerts/subscriptions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ departmentId }),
      });
      const data = (await response.json()) as SubscriptionSnapshot;

      setSubscriptionState(data);
      setDepartmentMessage(
        data.message ||
          (locale === "ko"
            ? "학과 구독을 해제했습니다."
            : "The department subscription has been removed."),
      );

      if (response.ok) {
        await refreshDepartmentState();
      }
    } finally {
      setDepartmentActionPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <details className="order-2 group rounded-lg border bg-muted/20">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:hidden">
          <span className="flex items-center justify-between gap-3">
            {locale === "ko"
              ? "학과 구독과 내 공지 관리"
              : "Department subscriptions and my alerts"}
            <span
              className="text-xs font-normal text-muted-foreground group-open:hidden"
              aria-hidden="true"
            >
              {locale === "ko" ? "펼치기" : "Open"}
            </span>
            <span
              className="hidden text-xs font-normal text-muted-foreground group-open:inline"
              aria-hidden="true"
            >
              {locale === "ko" ? "접기" : "Close"}
            </span>
          </span>
        </summary>
        <section className="flex flex-col gap-6 border-t p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {locale === "ko" ? "학과 구독과 내 알림" : "Department subscriptions and my alerts"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
              {locale === "ko"
                ? "관심 있는 학과를 구독하고 관련 공지를 모아볼 수 있습니다."
                : "Follow departments you care about and keep their notices together."}
            </p>
          </div>
          {subscriptionState.connected && subscriptionState.mode === "member" ? (
            <Popover open={openDepartmentPicker} onOpenChange={setOpenDepartmentPicker}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={departmentActionPending || availableDepartments.length === 0}
                >
                  <Search className="mr-2 size-4" />
                  {availableDepartments.length === 0
                    ? locale === "ko"
                      ? "추가할 학과 없음"
                      : "No departments left"
                    : locale === "ko"
                      ? "학과 구독 추가"
                      : "Add department"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="end">
                <Command>
                  <CommandInput
                    placeholder={locale === "ko" ? "학과 검색" : "Search departments"}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {locale === "ko" ? "검색 결과가 없습니다." : "No departments found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {availableDepartments.map((department) => (
                        <CommandItem
                          key={department.id}
                          value={department.name}
                          onSelect={() => void subscribeDepartment(department.id)}
                        >
                          {department.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>

        {loadingDepartments ? (
          <p className="rounded-lg border bg-muted/40 p-5 text-sm text-muted-foreground">
            {locale === "ko"
              ? "학과 구독 정보를 불러오는 중입니다."
              : "Loading department subscriptions."}
          </p>
        ) : !subscriptionState.configured ? (
          <p className="rounded-lg border bg-muted/40 p-5 text-sm text-muted-foreground">
            {locale === "ko"
              ? "학과 알림 연결을 준비 중입니다."
              : "Department alerts are not available yet."}
          </p>
        ) : !subscriptionState.connected ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
            <p>
              {locale === "ko"
                ? "계정 연결을 마치면 학과 구독과 내 알림을 사용할 수 있습니다."
                : "Connect your account to use department subscriptions and personal alerts."}
            </p>
            <div className="mt-4">
              <Button asChild>
                <Link href="/account">
                  {locale === "ko" ? "계정에서 연결하기" : "Connect from account"}
                </Link>
              </Button>
            </div>
          </div>
        ) : subscriptionState.mode === "guest" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
            <p>
              {locale === "ko"
                ? "건국대 메일 인증을 마치면 학과 구독을 사용할 수 있습니다."
                : "Verify your Konkuk email to use department subscriptions."}
            </p>
            <div className="mt-4">
              <Button asChild>
                <Link href="/account">
                  {locale === "ko" ? "계정에서 인증 이어가기" : "Continue from account"}
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 rounded-lg border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Bell className="size-4" />
              <p className="text-sm">
                {locale === "ko"
                  ? "구독 중인 학과를 눌러 해제할 수 있습니다."
                  : "Click a subscribed department to remove it."}
              </p>
            </div>

            {subscriptionState.subscriptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {subscriptionState.subscriptions.map((subscription) => (
                  <Badge
                    key={subscription.subscriptionId}
                    variant="secondary"
                    className="cursor-pointer px-3 py-2"
                    onClick={() => void unsubscribeDepartment(subscription.department.id)}
                  >
                    {subscription.department.name}
                    <X className="ml-2 size-3" />
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                {locale === "ko"
                  ? "아직 구독한 학과가 없습니다."
                  : "There are no department subscriptions yet."}
              </p>
            )}

            {departmentMessage ? (
              <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                {departmentMessage}
              </p>
            ) : null}

            {departmentAlerts.length === 0 ? (
              <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                {locale === "ko"
                  ? "구독한 학과의 새 알림이 아직 없습니다."
                  : "There are no department alerts yet."}
              </p>
            ) : (
              <div className="grid gap-4">
                {departmentAlerts.map((alert) => (
                  <article
                    key={alert.alertId}
                    className="rounded-lg border bg-muted/40 p-5"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="secondary">{alert.category}</Badge>
                      <p className="text-xs text-muted-foreground">
                        {locale === "ko" ? "게시일" : "Posted"}{" "}
                        {new Date(alert.publishedAt).toLocaleDateString(
                          locale === "ko" ? "ko-KR" : "en-US",
                        )}
                      </p>
                    </div>
                    <h3 className="mt-2 font-medium">{alert.title}</h3>
                    {alert.content ? (
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        {alert.content}
                      </p>
                    ) : null}
                    {alert.url ? (
                      <a
                        href={alert.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex items-center gap-2 text-sm underline underline-offset-4"
                      >
                        {locale === "ko" ? "원문 열기" : "Open source"}
                      </a>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
        </section>
      </details>

      <section className="order-1 flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{copy.alerts.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
              {copy.alerts.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={viewMode === "all" ? "default" : "secondary"}
              onClick={() => {
                setViewMode("all");
                setVisibleAlertCount(ALERT_PAGE_SIZE);
              }}
            >
              {copy.alerts.all}
            </Button>
            <Button
              type="button"
              variant={viewMode === "followed" ? "default" : "secondary"}
              onClick={() => {
                setViewMode("followed");
                setVisibleAlertCount(ALERT_PAGE_SIZE);
              }}
            >
              {copy.alerts.followed}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {visibleCategories.map((category) => {
            const active = categoryFilter === category;
            const followed = category !== "all" && followedCategories.includes(category);

            return (
              <div key={category} className="flex items-center gap-2">
                <Badge
                  variant={active ? "default" : "outline"}
                  className="cursor-pointer px-3 py-2"
                  onClick={() => {
                    setCategoryFilter(category);
                    setVisibleAlertCount(ALERT_PAGE_SIZE);
                  }}
                >
                  {category === "all"
                    ? locale === "ko"
                      ? "전체"
                      : "All"
                    : category}
                </Badge>
                {category !== "all" ? (
                  <button
                    type="button"
                    onClick={() => toggleFollowedCategory(category)}
                    className="text-xs text-muted-foreground underline underline-offset-4"
                  >
                    {followed ? copy.alerts.unfollow : copy.alerts.follow}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        {loading ? (
          <p className="rounded-lg border bg-muted/40 p-5 text-sm text-muted-foreground">
            {copy.alerts.loading}
          </p>
        ) : error ? (
          <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
            {error}
          </p>
        ) : visibleAlerts.length === 0 ? (
          <p className="rounded-lg border bg-muted/40 p-5 text-sm text-muted-foreground">
            {copy.alerts.empty}
          </p>
        ) : (
          <div className="grid gap-4">
            {pagedAlerts.map((alert) => (
              <article
                key={alert.id}
                className="rounded-lg border bg-card p-5"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="secondary">{alert.category}</Badge>
                  <p className="text-xs text-muted-foreground">
                    {copy.alerts.updatedAtPrefix}{" "}
                    {new Date(alert.publishedAt).toLocaleDateString(
                      locale === "ko" ? "ko-KR" : "en-US",
                    )}
                  </p>
                </div>
                <h3 className="mt-2 font-medium">{alert.title}</h3>
                {alert.excerpt ? (
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{alert.excerpt}</p>
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
            {visibleAlertCount < visibleAlerts.length ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() =>
                  setVisibleAlertCount((current) => current + ALERT_PAGE_SIZE)
                }
              >
                {locale === "ko"
                  ? `공지 더 보기 (${visibleAlerts.length - visibleAlertCount}개 남음)`
                  : `Show more (${visibleAlerts.length - visibleAlertCount} remaining)`}
              </Button>
            ) : null}
          </div>
        )}

        {departmentActionPending ? (
          <div className="flex items-center justify-center py-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : null}
      </section>
    </div>
  );
}
