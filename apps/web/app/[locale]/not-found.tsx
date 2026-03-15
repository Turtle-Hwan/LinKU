import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveRouteParams } from "@/lib/intl";

export default async function LocalizedNotFound({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const t = await getTranslations({ locale, namespace: "pages.notFound" });

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-start justify-center gap-6 px-6 py-16">
      <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
        {t("eyebrow")}
      </p>
      <h1 data-display="true" className="text-6xl leading-[0.95] tracking-[-0.05em]">
        {t("headline")}
      </h1>
      <p className="max-w-xl text-lg leading-8 text-[var(--muted)]">
        {t("body")}
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className="rounded-full border border-black/10 px-5 py-3">
          {t("ctaHome")}
        </Link>
        <Link href="/login" className="rounded-full border border-black/10 px-5 py-3">
          {t("ctaLogin")}
        </Link>
      </div>
    </section>
  );
}
