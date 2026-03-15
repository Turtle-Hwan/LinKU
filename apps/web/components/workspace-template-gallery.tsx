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

export function WorkspaceTemplateGallery({ locale }: { locale: AppLocale }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [templates, setTemplates] = useState<PostedTemplateSummaryWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const copy = useMemo(
    () => ({
      eyebrow: locale === "ko" ? "공개 갤러리" : "Public gallery",
      title: locale === "ko" ? "LinKU 공개 템플릿 갤러리" : "LinKU public template gallery",
      description:
        locale === "ko"
          ? "extension에서 보던 public template gallery를 web에서도 탐색하고, 좋아요를 누르고, 내 계정으로 복제할 수 있습니다."
          : "Browse, like, and clone the same public template gallery from the extension on the web.",
      searchPlaceholder:
        locale === "ko" ? "템플릿 이름 검색" : "Search template names",
      refresh: locale === "ko" ? "새로고침" : "Refresh",
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
    void loadGallery();
  }, [sort]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadGallery();
  }

  async function handleClone(template: PostedTemplateSummaryWithItems) {
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
          ? `"${template.name}" 템플릿을 내 backend 템플릿으로 복제했습니다.`
          : `Cloned "${template.name}" into your backend template library.`,
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
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {copy.eyebrow}
        </p>
        <h1 data-display="true" className="text-5xl tracking-[-0.05em]">
          {copy.title}
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--muted)]">
          {copy.description}
        </p>
      </div>

      <form
        className="flex flex-col gap-3 lg:flex-row lg:items-center"
        onSubmit={(event) => void handleSearchSubmit(event)}
      >
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={copy.searchPlaceholder}
          className="rounded-full bg-white"
        />
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortOption)}
          className="h-11 rounded-full border border-black/10 bg-white px-4 text-sm text-[var(--ink)]"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {getSortLabel(option, locale)}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" className="rounded-full">
          {locale === "ko" ? "검색" : "Search"}
        </Button>
        <Button
          type="button"
          className="rounded-full"
          onClick={() => void loadGallery()}
        >
          {copy.refresh}
        </Button>
      </form>

      {message ? (
        <div className="rounded-[1.2rem] border border-[#b0c38f] bg-[#eff8df] p-4 text-sm text-[#30411e]">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[1.2rem] border border-[#d0a7a7] bg-[#fdf0f0] p-4 text-sm text-[#6d2d2d]">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[1.2rem] border border-black/8 bg-white p-5 text-sm text-[var(--muted)]">
          {locale === "ko" ? "공개 템플릿을 불러오는 중입니다." : "Loading public templates."}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-[1.2rem] border border-dashed border-black/10 bg-white/70 p-5 text-sm text-[var(--muted)]">
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
                    className="rounded-full"
                    disabled={busyKey === `like-${template.postedTemplateId}`}
                    onClick={() => void handleLike(template)}
                  >
                    {template.isLiked ? copy.unlike : copy.like}
                  </Button>
                  <Button
                    type="button"
                    className="rounded-full"
                    disabled={busyKey === `clone-${template.postedTemplateId}`}
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
