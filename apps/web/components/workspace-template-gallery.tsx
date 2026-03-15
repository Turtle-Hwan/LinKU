"use client";

import { useState } from "react";
import { Button } from "@linku/ui";
import { WORKSPACE_TEMPLATE_PRESETS, localizeWorkspaceText } from "@linku/platform";
import type { AppLocale } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import { WorkspaceTemplateCard } from "@/components/workspace-template-card";
import { getWorkspaceCopy } from "@/lib/workspace-copy";
import { cloneGalleryPresetToTemplate } from "@/lib/workspace-templates";

export function WorkspaceTemplateGallery({ locale }: { locale: AppLocale }) {
  const copy = getWorkspaceCopy(locale);
  const router = useRouter();
  const [message, setMessage] = useState("");

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {copy.templates.galleryTitle}
        </p>
        <h1 data-display="true" className="text-5xl tracking-[-0.05em]">
          {copy.templates.galleryTitle}
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--muted)]">
          {copy.templates.galleryDescription}
        </p>
      </div>

      {message ? (
        <p className="rounded-[1.2rem] border border-[#b0c38f] bg-[#eff8df] p-4 text-sm text-[#30411e]">
          {message}
        </p>
      ) : null}

      <div className="grid gap-5">
        {WORKSPACE_TEMPLATE_PRESETS.slice(1).map((preset) => (
          <WorkspaceTemplateCard
            key={preset.id}
            template={{
              id: preset.id,
              name: localizeWorkspaceText(preset.title, locale),
              description: localizeWorkspaceText(preset.description, locale),
              shortcutIds: preset.shortcutIds,
              source: "gallery",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }}
            locale={locale}
            badges={[locale === "ko" ? "갤러리" : "Gallery"]}
            actions={
              <Button
                type="button"
                className="rounded-full"
                onClick={() => {
                  const cloned = cloneGalleryPresetToTemplate(preset.id, locale);
                  if (!cloned) {
                    return;
                  }

                  setMessage(
                    locale === "ko"
                      ? `"${cloned.name}" 템플릿을 내 템플릿에 복제했습니다.`
                      : `"${cloned.name}" has been cloned into your templates.`,
                  );
                  router.push("/templates");
                }}
              >
                {copy.templates.clonePreset}
              </Button>
            }
          />
        ))}
      </div>
    </div>
  );
}
