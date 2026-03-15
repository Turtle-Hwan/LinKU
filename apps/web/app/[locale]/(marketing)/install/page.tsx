import { getTranslations } from "next-intl/server";
import { CtaLink } from "@/components/cta-link";
import { resolveRouteParams } from "@/lib/intl";
import { createLocalizedMetadata } from "@/lib/seo";
import { siteEnv } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return createLocalizedMetadata({
    locale,
    titleKey: "pages.install.meta.title",
    descriptionKey: "pages.install.meta.description",
    path: "/install",
  });
}

export default async function InstallPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const t = await getTranslations({ locale });

  const installSteps = [
    t("site.guides.installExtension.step1"),
    t("site.guides.installExtension.step2"),
    t("site.guides.installExtension.step3"),
  ];

  const installReasons = [
    t("pages.install.reason1"),
    t("pages.install.reason2"),
    t("pages.install.reason3"),
  ];

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="rounded-[2rem] border border-black/8 bg-white/70 p-8 shadow-[0_30px_90px_rgba(19,42,34,0.08)]">
        <p className="mb-3 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {t("pages.install.eyebrow")}
        </p>
        <h1 data-display="true" className="mb-4 text-6xl leading-[0.95] tracking-[-0.05em]">
          {t("pages.install.headline")}
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--muted)]">
          {t("pages.install.body")}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <CtaLink href={siteEnv.extensionUrl} external>
            {t("pages.install.ctaStore")}
          </CtaLink>
          <CtaLink href="/login" variant="outline">
            {t("pages.install.ctaLogin")}
          </CtaLink>
        </div>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {installSteps.map((step, index) => (
            <li
              key={step}
              className="rounded-[1.2rem] border border-black/8 bg-[#f6f0e1] p-5 text-sm leading-6"
            >
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                {t("common.step")} 0{index + 1}
              </div>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {installReasons.map((item) => (
          <article
            key={item}
            className="rounded-[1.5rem] border border-black/8 bg-[var(--surface)] p-6 text-sm leading-7"
          >
            {item}
          </article>
        ))}
      </div>
    </section>
  );
}
