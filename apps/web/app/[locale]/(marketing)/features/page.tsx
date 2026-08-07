import {
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@linku/ui";
import { getTranslations } from "next-intl/server";
import { PageHeading } from "@/components/page-heading";
import { Link } from "@/i18n/navigation";
import { resolveRouteParams } from "@/lib/intl";
import { createLocalizedMetadata } from "@/lib/seo";
import { translateFeatures } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  return createLocalizedMetadata({
    locale,
    titleKey: "pages.features.meta.title",
    descriptionKey: "pages.features.meta.description",
    path: "/features",
  });
}

export default async function FeaturesPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const t = await getTranslations({ locale });
  const features = translateFeatures(t);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <PageHeading
        eyebrow={t("pages.features.eyebrow")}
        title={t("pages.features.headline")}
        body={t("pages.features.body")}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.slug}>
            <CardHeader>
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription className="leading-6">{feature.summary}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild variant="outline" size="sm">
                <Link href={feature.path}>{t("pages.features.openDetail")}</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
