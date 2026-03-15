import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { CtaLink } from "@/components/cta-link";
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

  if (!slug) {
    notFound();
  }

  const guide = translateGuides(t).find((item) => item.slug === slug);

  if (!guide) {
    notFound();
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <p className="mb-3 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
        {t("common.guide")}
      </p>
      <h1 data-display="true" className="mb-5 text-6xl leading-[0.95] tracking-[-0.05em]">
        {guide.title}
      </h1>
      <p className="mb-8 text-lg leading-8 text-[var(--muted)]">{guide.summary}</p>
      <ol className="grid gap-4">
        {guide.steps.map((step, index) => (
          <li
            key={step}
            className="rounded-[1.4rem] border border-black/8 bg-white/75 p-6 text-sm leading-7"
          >
            <div className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              {t("common.step")} 0{index + 1}
            </div>
            {step}
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap gap-3">
        <CtaLink href="/install" variant="outline">
          {t("pages.guideDetail.ctaInstall")}
        </CtaLink>
        <CtaLink href="/login" variant="ghost">
          {t("pages.guideDetail.ctaLogin")}
        </CtaLink>
      </div>
    </section>
  );
}
