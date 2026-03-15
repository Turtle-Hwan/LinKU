import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { CtaLink } from "@/components/cta-link";
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

  if (!slug) {
    notFound();
  }

  const service = translateServices(t).find((item) => item.slug === slug);

  if (!service) {
    notFound();
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <p className="mb-3 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
        {t("common.service")}
      </p>
      <h1 data-display="true" className="mb-5 text-6xl leading-[0.95] tracking-[-0.05em]">
        {service.title}
      </h1>
      <p className="mb-8 text-lg leading-8 text-[var(--muted)]">{service.summary}</p>
      <div className="rounded-[1.5rem] border border-black/8 bg-white/75 p-6">
        <p className="mb-4 text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
          {t("pages.serviceDetail.commonTasks")}
        </p>
        <ul className="space-y-3 text-sm leading-7">
          {service.tasks.map((task) => (
            <li key={task}>- {task}</li>
          ))}
        </ul>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <CtaLink href="/install" variant="outline">
          {t("pages.serviceDetail.ctaInstall")}
        </CtaLink>
        <CtaLink href="/features/ecampus" variant="ghost">
          {t("pages.serviceDetail.ctaFeature")}
        </CtaLink>
      </div>
    </section>
  );
}
