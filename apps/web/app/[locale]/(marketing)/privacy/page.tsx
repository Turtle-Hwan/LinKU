import { getTranslations } from "next-intl/server";
import { Card, CardDescription, CardHeader } from "@linku/ui";
import { PageHeading } from "@/components/page-heading";
import { resolveRouteParams } from "@/lib/intl";
import { createLocalizedMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return createLocalizedMetadata({
    locale,
    titleKey: "pages.privacy.meta.title",
    descriptionKey: "pages.privacy.meta.description",
    path: "/privacy",
  });
}

export default async function PrivacyPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const t = await getTranslations({ locale });

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHeading
        eyebrow={t("pages.privacy.eyebrow")}
        title={t("pages.privacy.headline")}
        body={t("pages.privacy.body")}
      />
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {[t("pages.privacy.point1"), t("pages.privacy.point2"), t("pages.privacy.point3")].map(
          (point) => (
            <Card key={point}>
              <CardHeader>
                <CardDescription className="leading-6">{point}</CardDescription>
              </CardHeader>
            </Card>
          ),
        )}
      </div>
    </section>
  );
}
