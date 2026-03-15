import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveRouteParams } from "@/lib/intl";
import { createLocalizedMetadata } from "@/lib/seo";
import { translateFeatures } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return createLocalizedMetadata({
    locale,
    titleKey: "pages.features.meta.title",
    descriptionKey: "pages.features.meta.description",
    path: "/features",
  });
}

export default async function FeaturesPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const t = await getTranslations({ locale });
  const features = translateFeatures(t);

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-8 max-w-3xl space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {t("pages.features.eyebrow")}
        </p>
        <h1 data-display="true" className="text-6xl tracking-[-0.05em]">
          {t("pages.features.headline")}
        </h1>
        <p className="text-lg leading-8 text-[var(--muted)]">
          {t("pages.features.body")}
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {features.map((feature) => (
          <Link
            key={feature.slug}
            href={feature.path}
            className="rounded-[1.5rem] border border-black/8 bg-white/75 p-6 transition hover:-translate-y-0.5"
          >
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              {t("common.feature")}
            </p>
            <h2 className="mb-3 text-3xl tracking-[-0.04em]">{feature.title}</h2>
            <p className="mb-4 text-sm leading-6 text-[var(--muted)]">{feature.summary}</p>
            <span className="text-sm font-medium underline underline-offset-4">
              {t("pages.features.openDetail")}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
