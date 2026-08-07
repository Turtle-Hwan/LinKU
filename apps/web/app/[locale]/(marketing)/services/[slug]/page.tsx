import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@linku/ui";
import { CtaLink } from "@/components/cta-link";
import { PageHeading } from "@/components/page-heading";
import { resolveRouteParams } from "@/lib/intl";
import { createLocalizedMetadata } from "@/lib/seo";
import { serviceMap, translateServices } from "@/lib/site";

export function generateStaticParams() {
  return Array.from(serviceMap.keys()).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string; slug?: string }>;
}) {
  const { locale, slug = "" } = await resolveRouteParams(params);
  const service = serviceMap.get(slug);

  if (!service) {
    return createLocalizedMetadata({
      locale,
      titleKey: "pages.serviceDetail.notFoundTitle",
      descriptionKey: "pages.serviceDetail.notFoundDescription",
      path: `/services/${slug}`,
    });
  }

  return createLocalizedMetadata({
    locale,
    titleKey: service.titleKey,
    descriptionKey: service.summaryKey,
    path: service.path,
  });
}

export default async function ServiceDetailPage({
  params,
}: {
  params?: Promise<{ locale?: string; slug?: string }>;
}) {
  const { locale, slug } = await resolveRouteParams(params);
  const t = await getTranslations({ locale });
  if (!slug) notFound();
  const service = translateServices(t).find((item) => item.slug === slug);
  if (!service) notFound();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <PageHeading
        eyebrow={t("common.service")}
        title={service.title}
        body={service.summary}
      />
      <p className="text-sm text-muted-foreground">
        {t("pages.services.audiencePrefix")}: {service.audience}
      </p>
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">
          {t("pages.serviceDetail.commonTasks")}
        </h2>
        <ul className="grid gap-3">
          {service.tasks.map((task) => (
            <li key={task}>
              <Card size="sm">
                <CardHeader>
                  <CardTitle className="leading-6">{task}</CardTitle>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-wrap gap-3">
          <CtaLink href="/install">{t("pages.serviceDetail.ctaInstall")}</CtaLink>
          <CtaLink href="/features/ecampus" variant="outline">
            {t("pages.serviceDetail.ctaFeature")}
          </CtaLink>
      </section>
    </div>
  );
}
