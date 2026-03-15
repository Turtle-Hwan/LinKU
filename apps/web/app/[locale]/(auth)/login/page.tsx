import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth, authRuntime, signIn } from "@/auth";
import { Button } from "@linku/ui";
import { CtaLink } from "@/components/cta-link";
import { getLocalizedPathname, resolveRouteParams } from "@/lib/intl";
import { createLocalizedMetadata } from "@/lib/seo";
import { siteEnv } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return createLocalizedMetadata({
    locale,
    titleKey: "pages.login.meta.title",
    descriptionKey: "pages.login.meta.description",
    path: "/login",
    index: false,
  });
}

export default async function LoginPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const t = await getTranslations({ locale });
  const session = await auth();

  if (session) {
    redirect({ href: "/dashboard", locale });
  }

  async function signInWithGoogle() {
    "use server";

    await signIn("google", {
      redirectTo: getLocalizedPathname("/dashboard", locale),
    });
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-77px)] max-w-5xl items-center px-6 py-16">
      <div className="grid w-full gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5">
          <p className="text-xs uppercase tracking-[0.24em] text-white/60">
            {t("pages.login.eyebrow")}
          </p>
          <h1 data-display="true" className="text-6xl leading-[0.95] tracking-[-0.05em]">
            {t("pages.login.headline")}
          </h1>
          <p className="max-w-xl text-lg leading-8 text-white/72">
            {t("pages.login.body")}
          </p>
          <div className="flex flex-wrap gap-3">
            <CtaLink href="/" variant="outline">
              {t("pages.login.ctaHome")}
            </CtaLink>
            <CtaLink href="/guides/install-extension" variant="ghost">
              {t("pages.login.ctaGuide")}
            </CtaLink>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/8 p-8 shadow-[0_30px_90px_rgba(6,16,12,0.35)] backdrop-blur">
          <p className="mb-3 text-xs uppercase tracking-[0.24em] text-white/60">
            {t("pages.login.cardEyebrow")}
          </p>
          <h2 className="mb-4 text-4xl tracking-[-0.04em]">{t("pages.login.cardTitle")}</h2>
          <p className="mb-8 text-sm leading-7 text-white/70">{t("pages.login.cardBody")}</p>

          <form action={signInWithGoogle}>
            <Button
              type="submit"
              disabled={!authRuntime.googleConfigured}
              className="w-full rounded-full"
            >
              {authRuntime.googleConfigured
                ? t("pages.login.continue")
                : t("pages.login.configure")}
            </Button>
          </form>

          <div className="mt-8 rounded-[1.4rem] border border-white/10 bg-black/10 p-5 text-sm leading-7 text-white/72">
            <p>
              {t("pages.login.siteUrl")}: {siteEnv.siteUrl}
            </p>
            <p>
              {t("pages.login.providerReady")}:{" "}
              {authRuntime.googleConfigured ? t("common.yes") : t("common.no")}
            </p>
            <p>
              {t("pages.login.authSecret")}:{" "}
              {authRuntime.hasAuthSecret ? t("common.yes") : t("common.no")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
