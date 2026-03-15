import { getTranslations } from "next-intl/server";
import { auth, authRuntime } from "@/auth";
import { LinkuBackendConnectionCard } from "@/components/linku-backend-connection-card";
import { resolveRouteParams } from "@/lib/intl";
import { getLinkuBackendSnapshot } from "@/lib/linku-backend";
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
    titleKey: "pages.account.meta.title",
    descriptionKey: "pages.account.meta.description",
    path: "/account",
    index: false,
  });
}

export default async function AccountPage({
  params,
  searchParams,
}: {
  params?: Promise<{ locale?: string }>;
  searchParams?: Promise<{ linkuStatus?: string | string[] }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const t = await getTranslations({ locale });
  const session = await auth();
  const linkuBackendSnapshot = await getLinkuBackendSnapshot();
  const user = session?.user;
  const initialStatus = Array.isArray(resolvedSearchParams?.linkuStatus)
    ? resolvedSearchParams?.linkuStatus[0]
    : resolvedSearchParams?.linkuStatus;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {t("pages.account.eyebrow")}
        </p>
        <h1 data-display="true" className="text-5xl tracking-[-0.05em]">
          {t("pages.account.headline")}
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--muted)]">
          {t("pages.account.body")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-[1.4rem] border border-black/8 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {t("pages.account.user")}
          </p>
          <h2 className="mt-3 text-2xl tracking-[-0.04em]">
            {user?.name || t("pages.account.signedInUser")}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {user?.email || t("pages.account.noEmail")}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {t("pages.account.sessionUserId")}:{" "}
            {user?.id || t("pages.account.notAvailable")}
          </p>
        </article>

        <LinkuBackendConnectionCard
          locale={locale}
          initialState={linkuBackendSnapshot}
          initialStatus={initialStatus}
        />

        <article className="rounded-[1.4rem] border border-black/8 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {t("pages.account.environment")}
          </p>
          <h2 className="mt-3 text-2xl tracking-[-0.04em]">
            {t("pages.account.authRuntime")}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {t("pages.account.canonicalSite")}: {siteEnv.siteUrl}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {t("pages.account.googleOAuthReady")}:{" "}
            {authRuntime.googleConfigured ? t("common.yes") : t("common.no")}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {t("pages.account.extensionId")}: {siteEnv.extensionId}
          </p>
        </article>
      </div>
    </div>
  );
}
