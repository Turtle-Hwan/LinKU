import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { CtaLink } from "@/components/cta-link";
import { resolveRouteParams } from "@/lib/intl";
import { createLocalizedMetadata } from "@/lib/seo";
import { featureMap, translateFeatures } from "@/lib/site";

export function generateStaticParams() {
  return Array.from(featureMap.keys()).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string; slug?: string }>;
}) {
  const { locale, slug = "" } = await resolveRouteParams(params);
  const feature = featureMap.get(slug);

  if (!feature) {
    return createLocalizedMetadata({
      locale,
      titleKey: "pages.featureDetail.notFoundTitle",
      descriptionKey: "pages.featureDetail.notFoundDescription",
      path: `/features/${slug}`,
    });
  }

  return createLocalizedMetadata({
    locale,
    titleKey: feature.titleKey,
    descriptionKey: feature.summaryKey,
    path: feature.path,
  });
}

export default async function FeatureDetailPage({
  params,
}: {
  params?: Promise<{ locale?: string; slug?: string }>;
}) {
  const { locale, slug } = await resolveRouteParams(params);
  const t = await getTranslations({ locale });

  if (!slug) {
    notFound();
  }

  const feature = translateFeatures(t).find((item) => item.slug === slug);

  if (!feature) {
    notFound();
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <p className="mb-3 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
        {t("common.feature")}
      </p>
      <h1 data-display="true" className="mb-5 text-6xl leading-[0.95] tracking-[-0.05em]">
        {feature.title}
      </h1>
      <p className="mb-8 text-lg leading-8 text-[var(--muted)]">{feature.summary}</p>
      <div className="grid gap-4">
        {feature.highlights.map((highlight) => (
          <article
            key={highlight}
            className="rounded-[1.4rem] border border-black/8 bg-white/70 p-6 text-sm leading-7"
          >
            {highlight}
          </article>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <CtaLink href="/install" variant="outline">
          {t("pages.featureDetail.ctaInstall")}
        </CtaLink>
        <CtaLink href="/guides/how-to-use-linku" variant="ghost">
          {t("pages.featureDetail.ctaGuide")}
        </CtaLink>
      </div>
    </section>
  );
}
