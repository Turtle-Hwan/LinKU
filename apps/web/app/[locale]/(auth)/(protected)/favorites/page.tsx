import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { FavoritesManager } from "@/components/favorites-manager";
import { WorkspacePageHeading } from "@/components/workspace-page-heading";
import { resolveRouteParams } from "@/lib/intl";
import { createLocalizedMetadata } from "@/lib/seo";
import { translateServices } from "@/lib/site";
import { getWorkspaceOwnerKey, readWorkspaceState } from "@/lib/workspace-store";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return createLocalizedMetadata({
    locale,
    titleKey: "pages.favorites.meta.title",
    descriptionKey: "pages.favorites.meta.description",
    path: "/favorites",
    index: false,
  });
}

export default async function FavoritesPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const t = await getTranslations({ locale });
  const state = await readWorkspaceState(getWorkspaceOwnerKey(await auth()));
  const services = translateServices(t);

  return (
    <div className="flex flex-col gap-8">
      <WorkspacePageHeading
        eyebrow={t("pages.favorites.eyebrow")}
        title={t("pages.favorites.headline")}
        description={t("pages.favorites.body")}
      />

      <FavoritesManager
        initialItems={state.favorites}
        suggestions={services.map((service) => ({
          title: service.title,
          path: service.path,
        }))}
      />
    </div>
  );
}
