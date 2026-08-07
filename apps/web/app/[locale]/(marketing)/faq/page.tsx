import { getTranslations } from "next-intl/server";
import { createFaqJsonLd } from "@linku/seo";
import { Card, CardDescription, CardHeader, CardTitle } from "@linku/ui";
import { JsonLd } from "@/components/json-ld";
import { PageHeading } from "@/components/page-heading";
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
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <JsonLd data={createFaqJsonLd(faqItems)} />
      <PageHeading
        eyebrow={t("pages.faq.eyebrow")}
        title={t("pages.faq.headline")}
        body={t("pages.faq.body")}
      />
      <div className="mt-6 grid gap-3">
        {faqItems.map((item) => (
          <Card key={item.slug} size="sm">
            <CardHeader>
              <CardTitle>{item.question}</CardTitle>
              <CardDescription className="max-w-3xl leading-6">{item.answer}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
