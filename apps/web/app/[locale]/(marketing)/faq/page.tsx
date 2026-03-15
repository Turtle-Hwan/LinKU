import { getTranslations } from "next-intl/server";
import { createFaqJsonLd } from "@linku/seo";
import { JsonLd } from "@/components/json-ld";
import { resolveRouteParams } from "@/lib/intl";
import { createLocalizedMetadata } from "@/lib/seo";
import { translateFaqItems } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return createLocalizedMetadata({
    locale,
    titleKey: "pages.faq.meta.title",
    descriptionKey: "pages.faq.meta.description",
    path: "/faq",
  });
}

export default async function FaqPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const t = await getTranslations({ locale });
  const faqItems = translateFaqItems(t);

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <JsonLd data={createFaqJsonLd(faqItems)} />
      <div className="mb-8 max-w-3xl space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {t("pages.faq.eyebrow")}
        </p>
        <h1 data-display="true" className="text-6xl tracking-[-0.05em]">
          {t("pages.faq.headline")}
        </h1>
        <p className="text-lg leading-8 text-[var(--muted)]">{t("pages.faq.body")}</p>
      </div>
      <div className="grid gap-4">
        {faqItems.map((item) => (
          <article key={item.slug} className="rounded-[1.4rem] border border-black/8 bg-white/75 p-6">
            <h2 className="mb-3 text-2xl tracking-[-0.04em]">{item.question}</h2>
            <p className="text-sm leading-7 text-[var(--muted)]">{item.answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
