import { getTranslations } from "next-intl/server";
import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@linku/ui";
import { auth } from "@/auth";
import { LinkuBackendConnectionCard } from "@/components/linku-backend-connection-card";
import { WorkspacePageHeading } from "@/components/workspace-page-heading";
import { Link } from "@/i18n/navigation";
import { resolveRouteParams } from "@/lib/intl";
import { getLinkuBackendSnapshot } from "@/lib/linku-backend";
import { createLocalizedMetadata } from "@/lib/seo";

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
    <div className="flex flex-col gap-8">
      <WorkspacePageHeading
        eyebrow={t("pages.account.eyebrow")}
        title={t("pages.account.headline")}
        description={t("pages.account.body")}
      />

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/extension/connect">
            {locale === "ko"
              ? "확장 프로그램 연결 관리"
              : "Manage extension connection"}
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>{t("pages.account.user")}</CardDescription>
            <CardTitle>{user?.name || t("pages.account.signedInUser")}</CardTitle>
            <CardDescription>{user?.email || t("pages.account.noEmail")}</CardDescription>
          </CardHeader>
        </Card>

        <LinkuBackendConnectionCard
          locale={locale}
          initialState={linkuBackendSnapshot}
          initialStatus={initialStatus}
        />
      </div>
    </div>
  );
}
