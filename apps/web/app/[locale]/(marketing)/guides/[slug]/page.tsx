import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Badge, Card, CardAction, CardHeader, CardTitle } from "@linku/ui";
import { CtaLink } from "@/components/cta-link";
import { PageHeading } from "@/components/page-heading";
import { resolveRouteParams } from "@/lib/intl";
import { createLocalizedMetadata } from "@/lib/seo";
import { guideMap, translateGuides } from "@/lib/site";

export function generateStaticParams() {
  return Array.from(guideMap.keys()).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string; slug?: string }>;
}) {
  const { locale, slug = "" } = await resolveRouteParams(params);
  const guide = guideMap.get(slug);
  if (!guide) {
    return createLocalizedMetadata({
      locale,
      titleKey: "pages.guideDetail.notFoundTitle",
      descriptionKey: "pages.guideDetail.notFoundDescription",
      path: `/guides/${slug}`,
    });
  }
  return createLocalizedMetadata({
    locale,
    titleKey: guide.titleKey,
    descriptionKey: guide.summaryKey,
    path: guide.path,
  });
}

export default async function GuideDetailPage({
  params,
}: {
  params?: Promise<{ locale?: string; slug?: string }>;
}) {
  const { locale, slug } = await resolveRouteParams(params);
  const t = await getTranslations({ locale });
  if (!slug) notFound();
  const guide = translateGuides(t).find((item) => item.slug === slug);
  if (!guide) notFound();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <PageHeading
        eyebrow={t("common.guide")}
        title={guide.title}
        body={guide.summary}
      />
      <section>
        <ol className="grid gap-3">
          {guide.steps.map((step, index) => (
            <li key={step}>
              <Card size="sm">
                <CardHeader>
                  <CardAction><Badge>{index + 1}</Badge></CardAction>
                  <CardTitle className="leading-6">{step}</CardTitle>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap gap-3">
          <CtaLink href="/install">{t("pages.guideDetail.ctaInstall")}</CtaLink>
          <CtaLink href="/login" variant="outline">{t("pages.guideDetail.ctaLogin")}</CtaLink>
        </div>
      </section>
    </div>
  );
}
