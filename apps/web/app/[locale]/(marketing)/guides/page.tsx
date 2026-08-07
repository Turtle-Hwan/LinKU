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
import { translateGuides } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  return createLocalizedMetadata({
    locale,
    titleKey: "pages.guides.meta.title",
    descriptionKey: "pages.guides.meta.description",
    path: "/guides",
  });
}

export default async function GuidesPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const t = await getTranslations({ locale });
  const guides = translateGuides(t);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <PageHeading
        eyebrow={t("pages.guides.eyebrow")}
        title={t("pages.guides.headline")}
        body={t("pages.guides.body")}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {guides.map((guide) => (
          <Card key={guide.slug}>
            <CardHeader>
              <CardTitle>{guide.title}</CardTitle>
              <CardDescription className="leading-6">{guide.summary}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild variant="outline" size="sm">
                <Link href={guide.path}>{locale === "ko" ? "읽기" : "Read"}</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
