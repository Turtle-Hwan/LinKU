import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { ExtensionConnectCard } from "@/components/extension-connect-card";
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
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {t("pages.extensionConnect.eyebrow")}
        </p>
        <h1 data-display="true" className="text-5xl tracking-[-0.05em]">
          {t("pages.extensionConnect.headline")}
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--muted)]">
          {t("pages.extensionConnect.body")}
        </p>
      </div>

      <ExtensionConnectCard
        initialState={state.extension}
        defaultExtensionId={siteEnv.extensionId}
      />
    </div>
  );
}
