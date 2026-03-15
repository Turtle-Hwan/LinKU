import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { FavoritesManager } from "@/components/favorites-manager";
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
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {t("pages.favorites.eyebrow")}
        </p>
        <h1 data-display="true" className="text-5xl tracking-[-0.05em]">
          {t("pages.favorites.headline")}
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--muted)]">
          {t("pages.favorites.body")}
        </p>
      </div>

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
