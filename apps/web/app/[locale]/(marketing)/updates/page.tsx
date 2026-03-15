import { getTranslations } from "next-intl/server";
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
    <section className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-8 max-w-3xl space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {t("pages.updates.eyebrow")}
        </p>
        <h1 data-display="true" className="text-6xl tracking-[-0.05em]">
          {t("pages.updates.headline")}
        </h1>
        <p className="text-lg leading-8 text-[var(--muted)]">
          {t("pages.updates.body")}
        </p>
      </div>
      <div className="grid gap-4">
        {updateEntries.map((entry) => (
          <article key={entry.slug} className="rounded-[1.5rem] border border-black/8 bg-white/75 p-6">
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              {entry.publishedAt}
            </p>
            <h2 className="mb-3 text-3xl tracking-[-0.04em]">{entry.title}</h2>
            <p className="mb-5 text-sm leading-7 text-[var(--muted)]">{entry.summary}</p>
            <ul className="space-y-2 text-sm leading-7">
              {entry.bullets.map((bullet) => (
                <li key={bullet}>- {bullet}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
