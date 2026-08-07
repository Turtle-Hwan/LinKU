import { getTranslations } from "next-intl/server";
import { Button } from "@linku/ui";
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
    <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-start justify-center gap-4 px-4 py-10 sm:px-6">
      <p className="text-sm font-medium text-main">{t("eyebrow")}</p>
      <h1 className="max-w-3xl text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        {t("headline")}
      </h1>
      <p className="max-w-xl text-base leading-7 text-muted-foreground">
        {t("body")}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/">{t("ctaHome")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">{t("ctaLogin")}</Link>
        </Button>
      </div>
    </section>
  );
}
