import { getTranslations } from "next-intl/server";
import { CtaLink } from "@/components/cta-link";
import { JsonLd } from "@/components/json-ld";
import { LinkuCardPreview } from "@/components/linku-card-preview";
import { Link } from "@/i18n/navigation";
import { resolveRouteParams } from "@/lib/intl";
import {
  translateFeatures,
  translateGuides,
  translateServices,
  translateUpdateEntries,
} from "@/lib/site";
import {
  createLocalizedMetadata,
  createLocalizedOrganizationJsonLd,
  createLocalizedSoftwareApplicationJsonLd,
} from "@/lib/seo";
import { siteEnv } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return createLocalizedMetadata({
    locale,
    titleKey: "pages.home.meta.title",
    descriptionKey: "pages.home.meta.description",
    path: "/",
  });
}

export default async function HomePage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const t = await getTranslations({ locale });
  const guides = translateGuides(t);
  const features = translateFeatures(t);
  const services = translateServices(t);
  const updates = translateUpdateEntries(t);

  const quickStats = [
    {
      label: t("pages.home.quickStats.domainLabel"),
      value: t("pages.home.quickStats.domainValue"),
    },
    {
      label: t("pages.home.quickStats.installLabel"),
      value: t("pages.home.quickStats.installValue"),
    },
    {
      label: t("pages.home.quickStats.authLabel"),
      value: t("pages.home.quickStats.authValue"),
    },
  ];

  return (
    <>
      <JsonLd data={await createLocalizedOrganizationJsonLd(locale)} />
      <JsonLd data={await createLocalizedSoftwareApplicationJsonLd(locale)} />

      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-8">
          <div className="inline-flex rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
            {t("pages.home.eyebrow")}
          </div>
          <div className="space-y-5">
            <p
              data-display="true"
              className="max-w-3xl text-6xl leading-[0.92] tracking-[-0.05em] text-[var(--ink)] md:text-8xl"
            >
              {t("pages.home.headline")}
            </p>
            <p className="max-w-2xl text-lg leading-8 text-[var(--muted)]">
              {t("pages.home.body")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <CtaLink href={siteEnv.extensionUrl} external>
              {t("pages.home.ctaInstall")}
            </CtaLink>
            <CtaLink href="/login" variant="outline">
              {t("pages.home.ctaLogin")}
            </CtaLink>
            <CtaLink href="/guides/install-extension" variant="ghost">
              {t("pages.home.ctaGuide")}
            </CtaLink>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {quickStats.map((item) => (
              <article
                key={item.label}
                className="rounded-[1.5rem] border border-black/8 bg-white/75 p-5 shadow-[0_20px_50px_rgba(19,42,34,0.08)]"
              >
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {item.label}
                </p>
                <h2 className="text-2xl leading-tight tracking-[-0.04em]">
                  {item.value}
                </h2>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <LinkuCardPreview locale={locale} />
          <div className="grid gap-4 md:grid-cols-2">
            {guides.map((guide) => (
              <Link
                key={guide.slug}
                href={guide.path}
                className="rounded-[1.4rem] border border-black/8 bg-[#132a22] p-5 text-white transition hover:-translate-y-0.5"
              >
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/60">
                  {t("common.guide")}
                </p>
                <div className="text-2xl tracking-[-0.04em]">{guide.title}</div>
                <p className="mt-3 text-sm leading-6 text-white/70">{guide.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-14 md:grid-cols-3">
        {features.map((feature) => (
          <article
            key={feature.slug}
            className="rounded-[1.6rem] border border-black/8 bg-[var(--surface)] p-6"
          >
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              {t("common.feature")}
            </p>
            <h2 className="mb-3 text-3xl tracking-[-0.04em]">{feature.title}</h2>
            <p className="mb-5 text-sm leading-6 text-[var(--muted)]">{feature.summary}</p>
            <Link href={feature.path} className="text-sm font-medium underline underline-offset-4">
              {t("pages.home.featureCta")}
            </Link>
          </article>
        ))}
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-14 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-black/8 bg-white/70 p-8 shadow-[0_30px_90px_rgba(19,42,34,0.08)]">
          <p className="mb-3 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            {t("pages.home.servicesEyebrow")}
          </p>
          <h2 data-display="true" className="mb-5 text-5xl leading-[0.96] tracking-[-0.05em]">
            {t("pages.home.servicesHeadline")}
          </h2>
          <div className="grid gap-4">
            {services.map((service) => (
              <Link
                key={service.slug}
                href={service.path}
                className="rounded-[1.3rem] border border-black/8 bg-[#f6f0e1] p-5 transition hover:border-black/20"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-2xl tracking-[-0.04em]">{service.title}</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                      {service.summary}
                    </p>
                  </div>
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {t("common.service")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-black/8 bg-[#132a22] p-8 text-white">
          <p className="mb-3 text-xs uppercase tracking-[0.24em] text-white/60">
            {t("pages.home.latestUpdateEyebrow")}
          </p>
          <h2 data-display="true" className="mb-5 text-5xl leading-[0.96] tracking-[-0.05em]">
            {updates[0]?.title}
          </h2>
          <p className="text-sm leading-7 text-white/75">{updates[0]?.summary}</p>
          <ul className="mt-6 space-y-3 text-sm leading-7 text-white/85">
            {updates[0]?.bullets.map((bullet) => (
              <li key={bullet}>- {bullet}</li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <CtaLink href="/updates" variant="secondary">
              {t("pages.home.readUpdates")}
            </CtaLink>
            <CtaLink href="/faq" variant="outline">
              {t("pages.home.seeFaq")}
            </CtaLink>
          </div>
        </div>
      </section>
    </>
  );
}
