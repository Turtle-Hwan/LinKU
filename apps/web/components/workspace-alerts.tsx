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
import type { Department, GeneralAlert, Subscription } from "@linku/shared-types";
import { Link } from "@/i18n/navigation";
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
  const [alerts, setAlerts] = useState<WorkspaceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "followed">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
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
    setFollowedCategories(readFollowedCategories());
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
    <div className="space-y-8">
      <section className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl tracking-[-0.04em]">
              {locale === "ko" ? "학과 구독과 내 알림" : "Department subscriptions and my alerts"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              {locale === "ko"
                ? "extension에서 보던 학과 구독과 내 알림 흐름을 web에서도 그대로 이어갑니다."
                : "Continue the same department subscription flow from the extension on the web."}
            </p>
          </div>
          {subscriptionState.connected && subscriptionState.mode === "member" ? (
            <Popover open={openDepartmentPicker} onOpenChange={setOpenDepartmentPicker}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-full"
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
          <p className="rounded-[1.2rem] border border-dashed border-black/10 bg-white/70 p-5 text-sm text-[var(--muted)]">
            {locale === "ko"
              ? "학과 구독 정보를 불러오는 중입니다."
              : "Loading department subscriptions."}
          </p>
        ) : !subscriptionState.configured ? (
          <p className="rounded-[1.2rem] border border-dashed border-black/10 bg-white/70 p-5 text-sm text-[var(--muted)]">
            {locale === "ko"
              ? "LINKU_API_BASE_URL이 설정되면 extension의 서버형 알림 흐름을 web에서도 사용할 수 있습니다."
              : "Set LINKU_API_BASE_URL to use the extension's server-backed alert flow on the web."}
          </p>
        ) : !subscriptionState.connected ? (
          <div className="rounded-[1.2rem] border border-[#d8c8a4] bg-[#fff8e6] p-5 text-sm leading-7 text-[#5f4a1b]">
            <p>
              {locale === "ko"
                ? "아직 LinKU backend가 연결되지 않았습니다. 계정 페이지에서 연결하면 학과 구독과 내 알림이 활성화됩니다."
                : "The LinKU backend is not connected yet. Connect it from the account page to unlock department subscriptions."}
            </p>
            <div className="mt-4">
              <Button asChild className="rounded-full">
                <Link href="/account">
                  {locale === "ko" ? "계정에서 연결하기" : "Connect from account"}
                </Link>
              </Button>
            </div>
          </div>
        ) : subscriptionState.mode === "guest" ? (
          <div className="rounded-[1.2rem] border border-[#d8c8a4] bg-[#fff8e6] p-5 text-sm leading-7 text-[#5f4a1b]">
            <p>
              {locale === "ko"
                ? "현재는 guest 연결 상태입니다. 건국대 메일 인증과 재연결을 마치면 학과 구독이 활성화됩니다."
                : "The current backend connection is still a guest session. Verify your Konkuk email and reconnect to enable department subscriptions."}
            </p>
            <div className="mt-4">
              <Button asChild className="rounded-full">
                <Link href="/account">
                  {locale === "ko" ? "계정에서 인증 이어가기" : "Continue from account"}
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 rounded-[1.4rem] border border-black/8 bg-white p-5">
            <div className="flex items-center gap-2 text-[var(--muted)]">
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
              <p className="rounded-[1.1rem] border border-dashed border-black/10 bg-[#f6f0e1] p-4 text-sm text-[var(--muted)]">
                {locale === "ko"
                  ? "아직 구독한 학과가 없습니다."
                  : "There are no department subscriptions yet."}
              </p>
            )}

            {departmentMessage ? (
              <p className="rounded-[1.1rem] border border-[#b0c38f] bg-[#eff8df] p-4 text-sm text-[#30411e]">
                {departmentMessage}
              </p>
            ) : null}

            {departmentAlerts.length === 0 ? (
              <p className="rounded-[1.1rem] border border-dashed border-black/10 bg-[#f6f0e1] p-4 text-sm text-[var(--muted)]">
                {locale === "ko"
                  ? "구독한 학과의 새 알림이 아직 없습니다."
                  : "There are no department alerts yet."}
              </p>
            ) : (
              <div className="grid gap-4">
                {departmentAlerts.map((alert) => (
                  <article
                    key={alert.alertId}
                    className="rounded-[1.2rem] border border-black/8 bg-[#f9f5ec] p-5"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="secondary">{alert.category}</Badge>
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        {locale === "ko" ? "게시일" : "Posted"}{" "}
                        {new Date(alert.publishedAt).toLocaleDateString(
                          locale === "ko" ? "ko-KR" : "en-US",
                        )}
                      </p>
                    </div>
                    <h3 className="mt-3 text-2xl tracking-[-0.04em]">{alert.title}</h3>
                    {alert.content ? (
                      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
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

      <section className="space-y-6 border-t border-black/8 pt-8">
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
          {visibleCategories.map((category) => {
            const active = categoryFilter === category;
            const followed = category !== "all" && followedCategories.includes(category);

            return (
              <div key={category} className="flex items-center gap-2">
                <Badge
                  variant={active ? "default" : "outline"}
                  className="cursor-pointer px-3 py-2"
                  onClick={() => setCategoryFilter(category)}
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

        {departmentActionPending ? (
          <div className="flex items-center justify-center py-2 text-[var(--muted)]">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : null}
      </section>
    </div>
  );
}
