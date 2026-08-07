"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Input } from "@linku/ui";
import type { PostedTemplateSummary } from "@linku/shared-types";
import type { AppLocale } from "@/i18n/routing";
import {
  clonePostedTemplate,
  getPostedTemplateDetail,
  getPublicPostedTemplates,
  toggleLikePostedTemplate,
} from "@/lib/remote-template-client";
import { WorkspaceTemplateCard } from "@/components/workspace-template-card";
import { WorkspaceTemplateGrid } from "@/components/workspace-template-grid";
import { WorkspacePageHeading } from "@/components/workspace-page-heading";

type SortOption = "newest" | "oldest" | "most-liked" | "most-used";

interface PostedTemplateSummaryWithItems extends PostedTemplateSummary {
  detailItems?: NonNullable<PostedTemplateSummary["detailItems"]>;
}

const SORT_OPTIONS: SortOption[] = [
  "newest",
  "most-liked",
  "most-used",
  "oldest",
];

function getSortLabel(option: SortOption, locale: AppLocale) {
  switch (option) {
    case "newest":
      return locale === "ko" ? "최신순" : "Newest";
    case "oldest":
      return locale === "ko" ? "오래된순" : "Oldest";
    case "most-liked":
      return locale === "ko" ? "좋아요순" : "Most liked";
    case "most-used":
      return locale === "ko" ? "복제순" : "Most cloned";
    default:
      return option;
  }
}

export function WorkspaceTemplateGallery({
  locale,
  backendConfigured,
  backendConnected,
  webSession,
}: {
  locale: AppLocale;
  backendConfigured: boolean;
  backendConnected: boolean;
  webSession: boolean;
}) {
  const canInteract = backendConfigured && backendConnected && webSession;
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [templates, setTemplates] = useState<PostedTemplateSummaryWithItems[]>([]);
  const [loading, setLoading] = useState(backendConfigured);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const copy = useMemo(
    () => ({
      eyebrow: locale === "ko" ? "공개 갤러리" : "Public gallery",
      title: locale === "ko" ? "LinKU 공개 템플릿 갤러리" : "LinKU public template gallery",
      description:
        locale === "ko"
          ? "다른 사용자의 바로가기 구성을 둘러보고 내 템플릿으로 가져올 수 있습니다."
          : "Browse shortcut layouts from other users and add one to your templates.",
      searchPlaceholder:
        locale === "ko" ? "템플릿 이름 검색" : "Search template names",
      refresh: locale === "ko" ? "새로고침" : "Refresh",
      missingConfig:
        locale === "ko"
          ? "공개 갤러리를 준비 중입니다."
          : "The public gallery is not available yet.",
      interactionNeedsBackend:
        locale === "ko"
          ? "좋아요와 복제를 사용하려면 계정을 연결해 주세요."
          : "Connect your account before liking or cloning templates.",
      interactionNeedsLogin:
        locale === "ko"
          ? "좋아요와 복제를 사용하려면 로그인해 주세요."
          : "Sign in before liking or cloning templates.",
      likes: locale === "ko" ? "좋아요" : "Likes",
      clones: locale === "ko" ? "복제" : "Clones",
      clone: locale === "ko" ? "내 템플릿으로 복제" : "Clone to my templates",
      like: locale === "ko" ? "좋아요" : "Like",
      unlike: locale === "ko" ? "좋아요 취소" : "Unlike",
      empty:
        locale === "ko"
          ? "조건에 맞는 공개 템플릿이 없습니다."
          : "No public templates match the current filters.",
    }),
    [locale],
  );

  async function loadGallery() {
    if (!backendConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await getPublicPostedTemplates({
        sort,
        query: searchQuery.trim() || undefined,
        page: 1,
        limit: 18,
      });

      const enriched = await Promise.all(
        result.map(async (template) => {
          try {
            const detail = await getPostedTemplateDetail(template.postedTemplateId);
            return {
              ...template,
              detailItems: detail.items,
            } satisfies PostedTemplateSummaryWithItems;
          } catch {
            return template;
          }
        }),
      );

      setTemplates(enriched);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : locale === "ko"
            ? "공개 템플릿을 불러오지 못했습니다."
            : "Failed to load public templates.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!backendConfigured) {
      return;
    }

    const timer = window.setTimeout(() => void loadGallery(), 0);

    return () => window.clearTimeout(timer);
  }, [backendConfigured, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadGallery();
  }

  async function handleClone(template: PostedTemplateSummaryWithItems) {
    if (!canInteract) {
      setError(
        !webSession ? copy.interactionNeedsLogin : copy.interactionNeedsBackend,
      );
      return;
    }

    setBusyKey(`clone-${template.postedTemplateId}`);
    setMessage("");
    setError("");

    try {
      await clonePostedTemplate(template.postedTemplateId);
      setTemplates((current) =>
        current.map((item) =>
          item.postedTemplateId === template.postedTemplateId
            ? {
                ...item,
                usageCount: item.usageCount + 1,
              }
            : item,
        ),
      );
      setMessage(
        locale === "ko"
          ? `"${template.name}" 템플릿을 내 목록에 추가했습니다.`
          : `Added "${template.name}" to your templates.`,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : locale === "ko"
            ? "템플릿 복제에 실패했습니다."
            : "Failed to clone the template.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleLike(template: PostedTemplateSummaryWithItems) {
    if (!canInteract) {
      setError(
        !webSession ? copy.interactionNeedsLogin : copy.interactionNeedsBackend,
      );
      return;
    }

    setBusyKey(`like-${template.postedTemplateId}`);
    setMessage("");
    setError("");

    try {
      const response = await toggleLikePostedTemplate(template.postedTemplateId);
      setTemplates((current) =>
        current.map((item) =>
          item.postedTemplateId === template.postedTemplateId
            ? {
                ...item,
                isLiked: response.isLiked,
                likesCount: response.likeCount,
              }
            : item,
        ),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : locale === "ko"
            ? "좋아요 처리에 실패했습니다."
            : "Failed to toggle the like state.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <WorkspacePageHeading
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />

      <form
        className="flex flex-col gap-3 lg:flex-row lg:items-center"
        onSubmit={(event) => void handleSearchSubmit(event)}
      >
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={copy.searchPlaceholder}
        />
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortOption)}
          disabled={!backendConfigured}
          className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {getSortLabel(option, locale)}
            </option>
          ))}
        </select>
        <Button
          type="submit"
          variant="secondary"
          disabled={!backendConfigured}
        >
          {locale === "ko" ? "검색" : "Search"}
        </Button>
        <Button
          type="button"
          disabled={!backendConfigured}
          onClick={() => void loadGallery()}
        >
          {copy.refresh}
        </Button>
      </form>

      {!backendConfigured ? (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          {copy.missingConfig}
        </div>
      ) : !canInteract ? (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          {!webSession ? copy.interactionNeedsLogin : copy.interactionNeedsBackend}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-lg border bg-muted/40 p-5 text-sm text-muted-foreground">
          {locale === "ko" ? "공개 템플릿을 불러오는 중입니다." : "Loading public templates."}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border bg-muted/40 p-5 text-sm text-muted-foreground">
          {copy.empty}
        </div>
      ) : (
        <div className="grid gap-5">
          {templates.map((template) => (
            <WorkspaceTemplateCard
              key={template.postedTemplateId}
              template={{
                name: template.name,
                description: `${locale === "ko" ? "게시자" : "Posted by"}: ${template.ownerName}`,
              }}
              locale={locale}
              badges={[
                `${copy.likes} ${template.likesCount}`,
                `${copy.clones} ${template.usageCount}`,
              ]}
              preview={
                template.detailItems ? (
                  <WorkspaceTemplateGrid items={template.detailItems} rows={template.height} />
                ) : undefined
              }
              itemCount={template.items}
              actions={
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canInteract || busyKey === `like-${template.postedTemplateId}`}
                    onClick={() => void handleLike(template)}
                  >
                    {template.isLiked ? copy.unlike : copy.like}
                  </Button>
                  <Button
                    type="button"
                    disabled={!canInteract || busyKey === `clone-${template.postedTemplateId}`}
                    onClick={() => void handleClone(template)}
                  >
                    {copy.clone}
                  </Button>
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
