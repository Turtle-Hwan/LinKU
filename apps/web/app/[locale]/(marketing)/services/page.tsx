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
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <PageHeading
        eyebrow={t("pages.services.eyebrow")}
        title={t("pages.services.headline")}
        body={t("pages.services.body")}
      />
      <div className="grid gap-4">
        {services.map((service) => (
          <Card key={service.slug} size="sm">
            <CardHeader>
              <CardTitle>{service.title}</CardTitle>
              <CardDescription>{service.summary}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild variant="outline" size="sm">
                <Link href={service.path}>{locale === "ko" ? "열기" : "Open"}</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
