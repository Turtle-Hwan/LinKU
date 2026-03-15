import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveRouteParams } from "@/lib/intl";
import { createLocalizedMetadata } from "@/lib/seo";
import { translateGuides } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return createLocalizedMetadata({
    locale,
    titleKey: "pages.guides.meta.title",
    descriptionKey: "pages.guides.meta.description",
    path: "/guides",
  });
}

export default async function GuidesPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const t = await getTranslations({ locale });
  const guides = translateGuides(t);

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-8 max-w-3xl space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {t("pages.guides.eyebrow")}
        </p>
        <h1 data-display="true" className="text-6xl tracking-[-0.05em]">
          {t("pages.guides.headline")}
        </h1>
        <p className="text-lg leading-8 text-[var(--muted)]">
          {t("pages.guides.body")}
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            href={guide.path}
            className="rounded-[1.5rem] border border-black/8 bg-white/75 p-6 transition hover:-translate-y-0.5"
          >
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              {t("common.guide")}
            </p>
            <h2 className="mb-3 text-3xl tracking-[-0.04em]">{guide.title}</h2>
            <p className="text-sm leading-6 text-[var(--muted)]">{guide.summary}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
