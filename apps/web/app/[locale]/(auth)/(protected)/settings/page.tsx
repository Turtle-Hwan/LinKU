import { getTranslations } from "next-intl/server";
import { SettingsPanel } from "@/components/settings-panel";
import { WorkspacePageHeading } from "@/components/workspace-page-heading";
import { resolveRouteParams } from "@/lib/intl";
import { createLocalizedMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return createLocalizedMetadata({
    locale,
    titleKey: "pages.settings.meta.title",
    descriptionKey: "pages.settings.meta.description",
    path: "/settings",
    index: false,
  });
}

export default async function SettingsPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const t = await getTranslations({ locale });
  return (
    <div className="flex flex-col gap-8">
      <WorkspacePageHeading
        eyebrow={t("pages.settings.eyebrow")}
        title={t("pages.settings.headline")}
        description={t("pages.settings.body")}
      />

      <SettingsPanel locale={locale} />
    </div>
  );
}
