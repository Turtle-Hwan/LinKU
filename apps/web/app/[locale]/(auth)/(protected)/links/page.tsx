import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { LinksManager } from "@/components/links-manager";
import { WorkspacePageHeading } from "@/components/workspace-page-heading";
import { resolveRouteParams } from "@/lib/intl";
import { createLocalizedMetadata } from "@/lib/seo";
import { getWorkspaceOwnerKey, readWorkspaceState } from "@/lib/workspace-store";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return createLocalizedMetadata({
    locale,
    titleKey: "pages.links.meta.title",
    descriptionKey: "pages.links.meta.description",
    path: "/links",
    index: false,
  });
}

export default async function LinksPage({
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
        eyebrow={t("pages.links.eyebrow")}
        title={t("pages.links.headline")}
        description={t("pages.links.body")}
      />

      <LinksManager initialItems={state.links} />
    </div>
  );
}
