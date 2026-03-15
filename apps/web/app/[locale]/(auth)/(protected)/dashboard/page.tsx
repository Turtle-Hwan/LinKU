import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { resolveRouteParams } from "@/lib/intl";
import { createLocalizedMetadata } from "@/lib/seo";
import { getWorkspaceOwnerKey, readWorkspaceState } from "@/lib/workspace-store";
import { translateAppNavLinks } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return createLocalizedMetadata({
    locale,
    titleKey: "pages.dashboard.meta.title",
    descriptionKey: "pages.dashboard.meta.description",
    path: "/dashboard",
    index: false,
  });
}

export default async function DashboardPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const t = await getTranslations({ locale });
  const state = await readWorkspaceState(getWorkspaceOwnerKey(await auth()));
  const appNavLinks = translateAppNavLinks(t);

  const summaryCards = [
    { label: t("pages.dashboard.stats.favorites"), value: String(state.favorites.length) },
    { label: t("pages.dashboard.stats.personalLinks"), value: String(state.links.length) },
    {
      label: t("pages.dashboard.stats.extension"),
      value: state.extension.connected
        ? t("pages.dashboard.stats.extensionConnected")
        : t("pages.dashboard.stats.extensionNotConnected"),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {t("pages.dashboard.eyebrow")}
        </p>
        <h1 data-display="true" className="text-5xl tracking-[-0.05em]">
          {t("pages.dashboard.headline")}
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--muted)]">
          {t("pages.dashboard.body")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => (
          <article key={card.label} className="rounded-[1.4rem] border border-black/8 bg-white p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{card.label}</p>
            <h2 className="mt-3 text-4xl tracking-[-0.04em]">{card.value}</h2>
          </article>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {appNavLinks.map((item) => (
          <Link key={item.slug} href={item.path} className="rounded-[1.4rem] border border-black/8 bg-[#f6f0e1] p-5">
            <h2 className="text-2xl tracking-[-0.04em]">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.summary}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
