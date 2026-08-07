import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { ExtensionConnectCard } from "@/components/extension-connect-card";
import { WorkspacePageHeading } from "@/components/workspace-page-heading";
import { resolveRouteParams } from "@/lib/intl";
import { createLocalizedMetadata } from "@/lib/seo";
import { siteEnv } from "@/lib/site";
import { getWorkspaceOwnerKey, readWorkspaceState } from "@/lib/workspace-store";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return createLocalizedMetadata({
    locale,
    titleKey: "pages.extensionConnect.meta.title",
    descriptionKey: "pages.extensionConnect.meta.description",
    path: "/extension/connect",
    index: false,
  });
}

export default async function ExtensionConnectPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const t = await getTranslations({ locale });
  const state = await readWorkspaceState(getWorkspaceOwnerKey(await auth()));

  return (
    <div className="flex flex-col gap-8">
      <WorkspacePageHeading
        eyebrow={t("pages.extensionConnect.eyebrow")}
        title={t("pages.extensionConnect.headline")}
        description={t("pages.extensionConnect.body")}
      />

      <ExtensionConnectCard
        initialState={state.extension}
        defaultExtensionId={siteEnv.extensionId}
      />
    </div>
  );
}
