import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveRouteParams } from "@/lib/intl";
import { createLocalizedMetadata } from "@/lib/seo";
import { translateServices } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return createLocalizedMetadata({
    locale,
    titleKey: "pages.services.meta.title",
    descriptionKey: "pages.services.meta.description",
    path: "/services",
  });
}

export default async function ServicesPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const t = await getTranslations({ locale });
  const services = translateServices(t);

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-8 max-w-3xl space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {t("pages.services.eyebrow")}
        </p>
        <h1 data-display="true" className="text-6xl tracking-[-0.05em]">
          {t("pages.services.headline")}
        </h1>
        <p className="text-lg leading-8 text-[var(--muted)]">
          {t("pages.services.body")}
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {services.map((service) => (
          <Link
            key={service.slug}
            href={service.path}
            className="rounded-[1.5rem] border border-black/8 bg-white/75 p-6 transition hover:-translate-y-0.5"
          >
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              {t("common.service")}
            </p>
            <h2 className="mb-3 text-3xl tracking-[-0.04em]">{service.title}</h2>
            <p className="mb-4 text-sm leading-6 text-[var(--muted)]">{service.summary}</p>
            <div className="text-sm text-[var(--ink)]">
              {t("pages.services.audiencePrefix")}: {service.audience}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
