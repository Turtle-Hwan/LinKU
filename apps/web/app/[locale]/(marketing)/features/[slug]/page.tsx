import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@linku/ui";
import { CtaLink } from "@/components/cta-link";
import { PageHeading } from "@/components/page-heading";
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

  if (!slug) notFound();
  const feature = translateFeatures(t).find((item) => item.slug === slug);
  if (!feature) notFound();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <PageHeading
        eyebrow={t("common.feature")}
        title={feature.title}
        body={feature.summary}
      />

      <section className="grid gap-4">
        <div>
          <h2 className="text-xl font-semibold">
            {locale === "ko" ? "이렇게 편해져요" : "How it helps"}
          </h2>
        </div>
        <div className="grid gap-3">
          {feature.highlights.map((highlight) => (
            <Card key={highlight} size="sm">
              <CardHeader>
                <CardTitle className="leading-6">{highlight}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">{locale === "ko" ? "Chrome에서 바로 사용해 보세요." : "Try it directly in Chrome."}</p>
          <div className="flex flex-wrap gap-3">
            <CtaLink href="/install">{t("pages.featureDetail.ctaInstall")}</CtaLink>
            <CtaLink href="/guides/how-to-use-linku" variant="outline">
              {t("pages.featureDetail.ctaGuide")}
            </CtaLink>
          </div>
      </section>
    </div>
  );
}
