"use client";

import { useState } from "react";
import { Button } from "@linku/ui";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import {
  createRemoteTemplate,
  deleteRemoteTemplate,
  getDefaultRemoteIcons,
  publishRemoteTemplate,
  updateRemoteTemplate,
} from "@/lib/remote-template-client";
import { buildRemoteTemplatePayload } from "@/lib/workspace-template-sync";
import { getWorkspaceCopy } from "@/lib/workspace-copy";
import {
  cloneWorkspaceTemplate,
  deleteWorkspaceTemplate,
  getSelectedWorkspaceTemplateSelection,
  listWorkspaceTemplates,
  saveWorkspaceTemplate,
  setSelectedWorkspaceTemplateSelection,
  type WorkspaceTemplateRecord,
} from "@/lib/workspace-templates";
import { WorkspaceTemplateCard } from "@/components/workspace-template-card";

function badgeForTemplate(template: WorkspaceTemplateRecord, locale: AppLocale) {
  if (template.source === "default") {
    return locale === "ko" ? "기본" : "Default";
  }

  if (template.source === "gallery") {
    return locale === "ko" ? "갤러리" : "Gallery";
  }

  return locale === "ko" ? "사용자" : "Custom";
}

export function WorkspaceLocalTemplateManager({
  locale,
  remoteAccess,
}: {
  locale: AppLocale;
  remoteAccess: {
    backendConfigured: boolean;
    backendConnected: boolean;
  };
}) {
  const copy = getWorkspaceCopy(locale);
  const canSyncRemote =
    remoteAccess.backendConfigured && remoteAccess.backendConnected;
  const [state, setState] = useState(() => {
    const selection = getSelectedWorkspaceTemplateSelection(locale);

    return {
      templates: listWorkspaceTemplates(locale),
      selectedTemplateId: selection.kind === "local" ? selection.templateId : null,
    };
  });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function refresh() {
    const selection = getSelectedWorkspaceTemplateSelection(locale);

    setState({
      templates: listWorkspaceTemplates(locale),
      selectedTemplateId: selection.kind === "local" ? selection.templateId : null,
    });
  }

  const { templates, selectedTemplateId } = state;
  const remoteStatusMessage = !remoteAccess.backendConfigured
    ? locale === "ko"
      ? "LINKU_API_BASE_URL이 비어 있어 backend 동기화와 게시를 아직 사용할 수 없습니다."
      : "LINKU_API_BASE_URL is missing, so backend sync and publish are unavailable."
    : !remoteAccess.backendConnected
      ? locale === "ko"
        ? "LinKU backend를 연결하면 local 템플릿을 서버에 동기화하고 공개 갤러리에 게시할 수 있습니다."
        : "Connect the LinKU backend to sync local templates and publish them to the public gallery."
      : "";

  async function syncTemplate(template: WorkspaceTemplateRecord) {
    if (!canSyncRemote) {
      setError(remoteStatusMessage);
      return;
    }

    setBusyKey(`sync-${template.id}`);
    setMessage("");
    setError("");

    try {
      const icons = await getDefaultRemoteIcons();
      const payload = buildRemoteTemplatePayload(template, icons, locale);
      const syncedTemplate = template.serverTemplateId
        ? await updateRemoteTemplate(template.serverTemplateId, {
            name: payload.name,
            height: payload.height,
            items: payload.items,
          })
        : await createRemoteTemplate(payload);

      saveWorkspaceTemplate({
        ...template,
        serverTemplateId: syncedTemplate.templateId,
        syncStatus: "synced",
        updatedAt: syncedTemplate.updatedAt || new Date().toISOString(),
      });
      refresh();
      setMessage(
        locale === "ko"
          ? `"${template.name}" 템플릿을 backend와 동기화했습니다.`
          : `Synced "${template.name}" with the backend.`,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : locale === "ko"
            ? "템플릿 동기화에 실패했습니다."
            : "Failed to sync the template.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function publishTemplate(template: WorkspaceTemplateRecord) {
    if (!template.serverTemplateId || template.syncStatus !== "synced") {
      return;
    }

    if (!canSyncRemote) {
      setError(remoteStatusMessage);
      return;
    }

    setBusyKey(`publish-${template.id}`);
    setMessage("");
    setError("");

    try {
      const response = await publishRemoteTemplate(template.serverTemplateId);
      saveWorkspaceTemplate({
        ...template,
        postedTemplateId: response.postedTemplateId,
        syncStatus: "synced",
      });
      refresh();
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

  async function handleDeleteTemplate(template: WorkspaceTemplateRecord) {
    setBusyKey(`delete-${template.id}`);
    setMessage("");
    setError("");

    try {
      if (template.serverTemplateId) {
        if (!canSyncRemote) {
          throw new Error(remoteStatusMessage);
        }

        await deleteRemoteTemplate(template.serverTemplateId);
      }

      deleteWorkspaceTemplate(template.id);
      refresh();
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 data-display="true" className="text-4xl tracking-[-0.05em]">
            {locale === "ko" ? "웹 로컬 템플릿" : "Web local templates"}
          </h2>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-[var(--muted)]">
            {copy.templates.description}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" className="rounded-full">
            <Link href="/gallery">{copy.templates.galleryTitle}</Link>
          </Button>
          <Button asChild className="rounded-full">
            <Link href="/editor?source=empty">{copy.templates.createEmpty}</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/editor?source=default">{copy.templates.createDefault}</Link>
          </Button>
        </div>
      </div>

      {message ? (
        <p className="rounded-[1.2rem] border border-[#b0c38f] bg-[#eff8df] p-4 text-sm text-[#30411e]">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-[1.2rem] border border-[#d0a7a7] bg-[#fdf0f0] p-4 text-sm text-[#6d2d2d]">
          {error}
        </p>
      ) : null}

      {remoteStatusMessage ? (
        <div className="rounded-[1.2rem] border border-black/8 bg-white p-4 text-sm text-[var(--muted)]">
          <p>{remoteStatusMessage}</p>
          <div className="mt-3">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/account">{locale === "ko" ? "계정 연결 열기" : "Open account setup"}</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {templates.length === 0 ? (
        <p className="rounded-[1.2rem] border border-dashed border-black/15 bg-white/70 p-5 text-sm leading-7 text-[var(--muted)]">
          {copy.templates.empty}
        </p>
      ) : (
        <div className="grid gap-5">
          {templates.map((template) => (
            <WorkspaceTemplateCard
              key={template.id}
              template={template}
              locale={locale}
              active={selectedTemplateId === template.id}
              badges={[
                badgeForTemplate(template, locale),
                template.syncStatus === "synced"
                  ? locale === "ko"
                    ? "backend 동기화됨"
                    : "Synced"
                  : template.source === "custom"
                    ? locale === "ko"
                      ? "로컬 편집본"
                      : "Local draft"
                    : "",
              ].filter(Boolean)}
              actions={
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-full"
                    onClick={() => {
                      setSelectedWorkspaceTemplateSelection({
                        kind: "local",
                        templateId: template.id,
                      });
                      refresh();
                    }}
                  >
                    {copy.templates.apply}
                  </Button>
                  {template.source === "custom" ? (
                    <Button asChild variant="outline" className="rounded-full">
                      <Link href={`/editor/${template.id}`}>{copy.templates.edit}</Link>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      cloneWorkspaceTemplate(template, locale);
                      refresh();
                    }}
                  >
                    {copy.templates.duplicate}
                  </Button>
                  {template.source === "custom" ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      disabled={!canSyncRemote || busyKey === `sync-${template.id}`}
                      onClick={() => void syncTemplate(template)}
                    >
                      {template.serverTemplateId && template.syncStatus === "synced"
                        ? locale === "ko"
                          ? "다시 동기화"
                          : "Resync"
                        : locale === "ko"
                          ? "backend 동기화"
                          : "Sync to backend"}
                    </Button>
                  ) : null}
                  {template.source === "custom" &&
                  template.serverTemplateId &&
                  template.syncStatus === "synced" ? (
                    <Button
                      type="button"
                      className="rounded-full"
                      disabled={!canSyncRemote || busyKey === `publish-${template.id}`}
                      onClick={() => void publishTemplate(template)}
                    >
                      {template.postedTemplateId
                        ? locale === "ko"
                          ? "다시 게시"
                          : "Republish"
                        : locale === "ko"
                          ? "공개 게시"
                          : "Publish"}
                    </Button>
                  ) : null}
                  {template.source === "custom" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-full"
                      disabled={busyKey === `delete-${template.id}`}
                      onClick={() => void handleDeleteTemplate(template)}
                    >
                      {copy.templates.remove}
                    </Button>
                  ) : null}
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
