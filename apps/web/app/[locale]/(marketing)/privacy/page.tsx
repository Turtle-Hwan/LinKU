import { getTranslations } from "next-intl/server";
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
    <section className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-8 max-w-3xl space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {t("pages.privacy.eyebrow")}
        </p>
        <h1 data-display="true" className="text-6xl tracking-[-0.05em]">
          {t("pages.privacy.headline")}
        </h1>
        <p className="text-lg leading-8 text-[var(--muted)]">
          {t("pages.privacy.body")}
        </p>
      </div>
      <div className="space-y-4 rounded-[1.5rem] border border-black/8 bg-white/75 p-6 text-sm leading-7 text-[var(--muted)]">
        <p>{t("pages.privacy.point1")}</p>
        <p>{t("pages.privacy.point2")}</p>
        <p>{t("pages.privacy.point3")}</p>
      </div>
    </section>
  );
}
