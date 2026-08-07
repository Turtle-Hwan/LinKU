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
          ? "내 템플릿과 복제한 템플릿, 공개한 템플릿을 한곳에서 관리합니다."
          : "Manage your templates, cloned layouts, and public templates in one place.",
      backendNote:
        locale === "ko"
          ? "계정을 연결하면 템플릿을 여러 기기에서 이어서 쓰고 갤러리에 공개할 수 있습니다."
          : "Connect your account to keep templates across devices and publish them to the gallery.",
      remoteNeedsLogin:
        locale === "ko"
          ? "저장한 템플릿을 보려면 로그인해 주세요."
          : "Sign in to view your saved templates.",
      remoteNeedsConfig:
        locale === "ko"
          ? "계정 템플릿 기능을 준비 중입니다."
          : "Account templates are not available yet.",
      remoteNeedsBackendConnection:
        locale === "ko"
          ? "저장한 템플릿을 불러오려면 계정을 연결해 주세요."
          : "Connect your account to load your saved templates.",
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
          ? "아직 저장한 템플릿이 없습니다."
          : "No saved templates yet.",
      emptyCloned:
        locale === "ko"
          ? "아직 복제한 템플릿이 없습니다."
          : "No cloned templates yet.",
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

    const timer = window.setTimeout(() => void loadRemoteLibraries(), 0);

    return () => window.clearTimeout(timer);
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
        : `Applied "${template.name}" to the dashboard.`,
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
          ? `"${template.name}" 템플릿을 삭제했습니다.`
          : `Deleted "${template.name}".`,
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
        <div className="rounded-lg border bg-muted/40 p-5 text-sm text-muted-foreground">
          {locale === "ko" ? "템플릿을 불러오는 중입니다." : "Loading templates."}
        </div>
      );
    }

    if (templates.length === 0) {
      return (
        <div className="rounded-lg border bg-muted/40 p-5 text-sm text-muted-foreground">
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
                  onClick={() => void applyRemoteTemplate(template)}
                >
                  {copy.apply}
                </Button>
                {showPublishAction ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busyKey === `publish-${template.templateId}`}
                    onClick={() => void handlePublish(template)}
                  >
                    {copy.publish}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
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
        <div className="rounded-lg border bg-muted/40 p-5 text-sm text-muted-foreground">
          {locale === "ko" ? "공개 템플릿을 불러오는 중입니다." : "Loading posted templates."}
        </div>
      );
    }

    if (postedTemplates.length === 0) {
      return (
        <div className="rounded-lg border bg-muted/40 p-5 text-sm text-muted-foreground">
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 data-display="true" className="text-2xl tracking-tight sm:text-3xl">
            {copy.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
            {copy.description}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!canLoadRemote}
            onClick={() => void loadRemoteLibraries()}
          >
            {copy.refresh}
          </Button>
          <Button
            type="button"
            onClick={() => router.push("/gallery")}
          >
            {copy.openGallery}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/40 p-5 text-sm leading-7 text-muted-foreground">
        {copy.backendNote}
      </div>

      {remoteStatusMessage ? (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          {remoteStatusMessage}
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

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LibraryTab)}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="local">
            {locale === "ko" ? "이 브라우저" : "This browser"}
          </TabsTrigger>
          <TabsTrigger value="owned">
            {locale === "ko" ? "내 템플릿" : "Mine"}
          </TabsTrigger>
          <TabsTrigger value="cloned">
            {locale === "ko" ? "복제한 템플릿" : "Cloned"}
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
