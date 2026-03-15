import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { LinksManager } from "@/components/links-manager";
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
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {t("pages.links.eyebrow")}
        </p>
        <h1 data-display="true" className="text-5xl tracking-[-0.05em]">
          {t("pages.links.headline")}
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--muted)]">
          {t("pages.links.body")}
        </p>
      </div>

      <LinksManager initialItems={state.links} />
    </div>
  );
}
