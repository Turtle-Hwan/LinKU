"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@linku/ui";
import type {
  PostedTemplateSummary,
  Template,
  TemplateSummary,
} from "@linku/shared-types";
import type { AppLocale } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import {
  deleteRemoteTemplate,
  deletePostedTemplate,
  getClonedRemoteTemplates,
  getMyPostedTemplates,
  getOwnedRemoteTemplates,
  getPostedTemplateDetail,
  getRemoteTemplate,
  publishRemoteTemplate,
  toggleLikePostedTemplate,
} from "@/lib/remote-template-client";
import {
  getDefaultWorkspaceTemplate,
  getSelectedWorkspaceTemplateSelection,
  setSelectedWorkspaceTemplateId,
  setSelectedWorkspaceTemplateSelection,
} from "@/lib/workspace-templates";
import { WorkspaceLocalTemplateManager } from "@/components/workspace-local-template-manager";
import { WorkspaceTemplateCard } from "@/components/workspace-template-card";
import { WorkspaceTemplateGrid } from "@/components/workspace-template-grid";

type LibraryTab = "local" | "owned" | "cloned" | "posted";

interface TemplateSummaryWithItems extends TemplateSummary {
  detailItems?: Template["items"];
}

interface PostedTemplateSummaryWithItems extends PostedTemplateSummary {
  detailItems?: NonNullable<PostedTemplateSummary["detailItems"]>;
}

export function WorkspaceTemplateManager({
  locale,
  remoteAccess,
}: {
  locale: AppLocale;
  remoteAccess: {
    webSession: boolean;
    backendConfigured: boolean;
    backendConnected: boolean;
  };
}) {
  const router = useRouter();
  const canLoadRemote =
    remoteAccess.webSession &&
    remoteAccess.backendConfigured &&
    remoteAccess.backendConnected;
  const [activeTab, setActiveTab] = useState<LibraryTab>("local");
  const [ownedTemplates, setOwnedTemplates] = useState<TemplateSummaryWithItems[]>([]);
  const [clonedTemplates, setClonedTemplates] = useState<TemplateSummaryWithItems[]>([]);
  const [postedTemplates, setPostedTemplates] = useState<PostedTemplateSummaryWithItems[]>([]);
  const [loading, setLoading] = useState(canLoadRemote);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const copy = useMemo(
    () => ({
      title: locale === "ko" ? "템플릿 허브" : "Template hub",
      description:
        locale === "ko"
          ? "웹 로컬 템플릿과 LinKU backend의 owned, cloned, posted 템플릿을 한 곳에서 관리합니다."
          : "Manage web-local templates and LinKU backend owned, cloned, and posted templates in one place.",
      backendNote:
        locale === "ko"
          ? "LinKU backend를 연결하면 extension에서 쓰던 템플릿 서버 기능을 web에서도 그대로 사용할 수 있습니다."
          : "Connect the LinKU backend to unlock the same server template flows on the web.",
      remoteNeedsLogin:
        locale === "ko"
          ? "backend 템플릿 라이브러리를 보려면 LinKU 웹 로그인이 필요합니다."
          : "Sign in to LinKU web to access the backend template library.",
      remoteNeedsConfig:
        locale === "ko"
          ? "LINKU_API_BASE_URL이 비어 있어 backend 템플릿 기능을 아직 열 수 없습니다."
          : "LINKU_API_BASE_URL is missing, so backend template features are not available yet.",
      remoteNeedsBackendConnection:
        locale === "ko"
          ? "LinKU backend를 먼저 연결해야 owned, cloned, posted 템플릿을 불러올 수 있습니다."
          : "Connect the LinKU backend before loading owned, cloned, and posted templates.",
      apply: locale === "ko" ? "적용" : "Apply",
      openGallery: locale === "ko" ? "공개 갤러리 열기" : "Open public gallery",
      delete: locale === "ko" ? "삭제" : "Delete",
      postedBy: locale === "ko" ? "게시자" : "Posted by",
      likes: locale === "ko" ? "좋아요" : "Likes",
      clones: locale === "ko" ? "복제" : "Clones",
      publish: locale === "ko" ? "게시" : "Publish",
      unpost: locale === "ko" ? "게시 취소" : "Unpublish",
      refresh: locale === "ko" ? "새로고침" : "Refresh",
      emptyOwned:
        locale === "ko"
          ? "아직 backend 소유 템플릿이 없습니다."
          : "No backend-owned templates yet.",
      emptyCloned:
        locale === "ko"
          ? "복제한 backend 템플릿이 없습니다."
          : "No cloned backend templates yet.",
      emptyPosted:
        locale === "ko"
          ? "공개로 게시한 템플릿이 없습니다."
          : "No posted templates yet.",
    }),
    [locale],
  );
  const remoteStatusMessage =
    !remoteAccess.webSession
      ? copy.remoteNeedsLogin
      : !remoteAccess.backendConfigured
        ? copy.remoteNeedsConfig
        : !remoteAccess.backendConnected
          ? copy.remoteNeedsBackendConnection
        : "";

  async function enrichTemplateList(list: TemplateSummary[]) {
    return Promise.all(
      list.map(async (template) => {
        try {
          const detail = await getRemoteTemplate(template.templateId);
          return {
            ...template,
            detailItems: detail.items,
          } satisfies TemplateSummaryWithItems;
        } catch {
          return template;
        }
      }),
    );
  }

  async function enrichPostedList(list: PostedTemplateSummary[]) {
    return Promise.all(
      list.map(async (template) => {
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
  }

  async function loadRemoteLibraries() {
    if (!canLoadRemote) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [owned, cloned, posted] = await Promise.all([
        getOwnedRemoteTemplates(),
        getClonedRemoteTemplates(),
        getMyPostedTemplates(),
      ]);

      const [ownedWithItems, clonedWithItems, postedWithItems] = await Promise.all([
        enrichTemplateList(owned),
        enrichTemplateList(cloned),
        enrichPostedList(posted),
      ]);

      setOwnedTemplates(ownedWithItems);
      setClonedTemplates(clonedWithItems);
      setPostedTemplates(postedWithItems);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : locale === "ko"
            ? "템플릿 목록을 불러오지 못했습니다."
            : "Failed to load the template library.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canLoadRemote) {
      return;
    }

    void loadRemoteLibraries();
  }, [canLoadRemote]); // eslint-disable-line react-hooks/exhaustive-deps

  async function applyRemoteTemplate(template: TemplateSummaryWithItems) {
    let resolvedItems = template.detailItems;

    if (!resolvedItems) {
      const detail = await getRemoteTemplate(template.templateId);
      resolvedItems = detail.items;
    }

    setSelectedWorkspaceTemplateSelection({
      kind: "remote",
      templateId: template.templateId,
      cachedName: template.name,
      cachedHeight: template.height,
      cachedItems: resolvedItems,
    });

    setMessage(
      locale === "ko"
        ? `"${template.name}" 템플릿을 웹 대시보드에 적용했습니다.`
        : `Applied "${template.name}" to the web dashboard.`,
    );
    router.push("/dashboard");
  }

  async function handlePublish(template: TemplateSummaryWithItems) {
    setBusyKey(`publish-${template.templateId}`);
    setMessage("");
    setError("");

    try {
      await publishRemoteTemplate(template.templateId);
      await loadRemoteLibraries();
      setActiveTab("posted");
      setMessage(
        locale === "ko"
          ? `"${template.name}" 템플릿을 공개 갤러리에 게시했습니다.`
          : `Published "${template.name}" to the public gallery.`,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : locale === "ko"
            ? "템플릿 게시에 실패했습니다."
            : "Failed to publish the template.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteTemplate(template: TemplateSummaryWithItems) {
    setBusyKey(`delete-${template.templateId}`);
    setMessage("");
    setError("");

    try {
      await deleteRemoteTemplate(template.templateId);
      const selection = getSelectedWorkspaceTemplateSelection(locale);
      if (selection.kind === "remote" && selection.templateId === template.templateId) {
        setSelectedWorkspaceTemplateId(getDefaultWorkspaceTemplate(locale).id);
      }
      await loadRemoteLibraries();
      setMessage(
        locale === "ko"
          ? `"${template.name}" 템플릿을 backend 라이브러리에서 삭제했습니다.`
          : `Deleted "${template.name}" from the backend library.`,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : locale === "ko"
            ? "템플릿 삭제에 실패했습니다."
            : "Failed to delete the template.",
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
      setPostedTemplates((current) =>
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

  async function handleUnpost(template: PostedTemplateSummaryWithItems) {
    setBusyKey(`unpost-${template.postedTemplateId}`);
    setMessage("");
    setError("");

    try {
      await deletePostedTemplate(template.postedTemplateId);
      await loadRemoteLibraries();
      setMessage(
        locale === "ko"
          ? `"${template.name}" 템플릿 게시를 취소했습니다.`
          : `Unpublished "${template.name}".`,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : locale === "ko"
            ? "게시 취소에 실패했습니다."
            : "Failed to unpublish the template.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  function renderTemplateList(
    templates: TemplateSummaryWithItems[],
    emptyMessage: string,
    showPublishAction: boolean,
  ) {
    if (loading) {
      return (
        <div className="rounded-[1.2rem] border border-black/8 bg-white p-5 text-sm text-[var(--muted)]">
          {locale === "ko" ? "backend 템플릿을 불러오는 중입니다." : "Loading backend templates."}
        </div>
      );
    }

    if (templates.length === 0) {
      return (
        <div className="rounded-[1.2rem] border border-dashed border-black/10 bg-white/70 p-5 text-sm text-[var(--muted)]">
          {emptyMessage}
        </div>
      );
    }

    return (
      <div className="grid gap-5">
        {templates.map((template) => (
          <WorkspaceTemplateCard
            key={template.templateId}
            template={{
              name: template.name,
              description:
                locale === "ko"
                  ? `마지막 수정 ${template.updatedAt}`
                  : `Last updated ${template.updatedAt}`,
            }}
            locale={locale}
            badges={[
              locale === "ko"
                ? `항목 ${template.itemCount ?? template.detailItems?.length ?? 0}`
                : `Items ${template.itemCount ?? template.detailItems?.length ?? 0}`,
              template.cloned
                ? locale === "ko"
                  ? "클론"
                  : "Cloned"
                : locale === "ko"
                  ? "소유"
                  : "Owned",
            ]}
            preview={
              template.detailItems ? (
                <WorkspaceTemplateGrid items={template.detailItems} rows={template.height} />
              ) : undefined
            }
            itemCount={template.itemCount ?? template.detailItems?.length ?? 0}
            actions={
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-full"
                  onClick={() => void applyRemoteTemplate(template)}
                >
                  {copy.apply}
                </Button>
                {showPublishAction ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    disabled={busyKey === `publish-${template.templateId}`}
                    onClick={() => void handlePublish(template)}
                  >
                    {copy.publish}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full"
                  disabled={busyKey === `delete-${template.templateId}`}
                  onClick={() => void handleDeleteTemplate(template)}
                >
                  {copy.delete}
                </Button>
              </>
            }
          />
        ))}
      </div>
    );
  }

  function renderPostedList() {
    if (loading) {
      return (
        <div className="rounded-[1.2rem] border border-black/8 bg-white p-5 text-sm text-[var(--muted)]">
          {locale === "ko" ? "공개 템플릿을 불러오는 중입니다." : "Loading posted templates."}
        </div>
      );
    }

    if (postedTemplates.length === 0) {
      return (
        <div className="rounded-[1.2rem] border border-dashed border-black/10 bg-white/70 p-5 text-sm text-[var(--muted)]">
          {copy.emptyPosted}
        </div>
      );
    }

    return (
      <div className="grid gap-5">
        {postedTemplates.map((template) => (
          <WorkspaceTemplateCard
            key={template.postedTemplateId}
            template={{
              name: template.name,
              description: `${copy.postedBy}: ${template.ownerName}`,
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
                  {template.isLiked
                    ? locale === "ko"
                      ? "좋아요 취소"
                      : "Unlike"
                    : locale === "ko"
                      ? "좋아요"
                      : "Like"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full"
                  disabled={busyKey === `unpost-${template.postedTemplateId}`}
                  onClick={() => void handleUnpost(template)}
                >
                  {copy.unpost}
                </Button>
              </>
            }
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 data-display="true" className="text-5xl tracking-[-0.05em]">
            {copy.title}
          </h1>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-[var(--muted)]">
            {copy.description}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="rounded-full"
            disabled={!canLoadRemote}
            onClick={() => void loadRemoteLibraries()}
          >
            {copy.refresh}
          </Button>
          <Button
            type="button"
            className="rounded-full"
            onClick={() => router.push("/gallery")}
          >
            {copy.openGallery}
          </Button>
        </div>
      </div>

      <div className="rounded-[1.2rem] border border-black/8 bg-[#f6f0e1] p-5 text-sm leading-7 text-[var(--muted)]">
        {copy.backendNote}
      </div>

      {remoteStatusMessage ? (
        <div className="rounded-[1.2rem] border border-black/8 bg-white p-4 text-sm text-[var(--muted)]">
          {remoteStatusMessage}
        </div>
      ) : null}

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

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LibraryTab)}>
        <TabsList className="h-auto flex-wrap rounded-[1.2rem] border border-black/8 bg-white p-2">
          <TabsTrigger value="local">
            {locale === "ko" ? "웹 로컬" : "Web local"}
          </TabsTrigger>
          <TabsTrigger value="owned">
            {locale === "ko" ? "내 backend" : "Owned"}
          </TabsTrigger>
          <TabsTrigger value="cloned">
            {locale === "ko" ? "복제한 backend" : "Cloned"}
          </TabsTrigger>
          <TabsTrigger value="posted">
            {locale === "ko" ? "공개 게시" : "Posted"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="local" className="mt-6">
          <WorkspaceLocalTemplateManager locale={locale} remoteAccess={remoteAccess} />
        </TabsContent>

        <TabsContent value="owned" className="mt-6">
          {renderTemplateList(ownedTemplates, copy.emptyOwned, true)}
        </TabsContent>

        <TabsContent value="cloned" className="mt-6">
          {renderTemplateList(clonedTemplates, copy.emptyCloned, true)}
        </TabsContent>

        <TabsContent value="posted" className="mt-6">
          {renderPostedList()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
