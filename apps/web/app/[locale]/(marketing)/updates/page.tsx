import { getTranslations } from "next-intl/server";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@linku/ui";
import { PageHeading } from "@/components/page-heading";
import { resolveRouteParams } from "@/lib/intl";
import { createLocalizedMetadata } from "@/lib/seo";
import { translateUpdateEntries } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return createLocalizedMetadata({
    locale,
    titleKey: "pages.updates.meta.title",
    descriptionKey: "pages.updates.meta.description",
    path: "/updates",
  });
}

export default async function UpdatesPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const t = await getTranslations({ locale });
  const updateEntries = translateUpdateEntries(t);

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHeading
        eyebrow={t("pages.updates.eyebrow")}
        title={t("pages.updates.headline")}
        body={t("pages.updates.body")}
      />
      <div className="mt-6 grid gap-4">
        {updateEntries.map((entry) => (
          <Card key={entry.slug}>
            <CardHeader>
              <Badge variant="outline">{entry.publishedAt}</Badge>
              <CardTitle>{entry.title}</CardTitle>
              <CardDescription>{entry.summary}</CardDescription>
            </CardHeader>
            <CardContent>
            <ul className="grid gap-2 text-sm leading-6">
              {entry.bullets.map((bullet) => (
                <li key={bullet}>• {bullet}</li>
              ))}
            </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
