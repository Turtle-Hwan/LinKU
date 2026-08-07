import { createPageMetadata } from "@linku/seo";
import { WorkspaceAlerts } from "@/components/workspace-alerts";
import { WorkspacePageHeading } from "@/components/workspace-page-heading";
import {
  getLocaleAlternates,
  getLocalizedPathname,
  resolveRouteParams,
} from "@/lib/intl";
import { siteEnv } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return createPageMetadata({
    title: locale === "ko" ? "공지사항 | LinKU" : "Alerts | LinKU",
    description:
      locale === "ko"
        ? "건국대 공지와 구독한 학과 공지를 LinKU 웹에서 확인하세요."
        : "Review Konkuk notices and subscribed department alerts in LinKU web.",
    path: getLocalizedPathname("/alerts", locale),
    imagePath: getLocalizedPathname("/opengraph-image", locale),
    siteUrl: siteEnv.siteUrl,
    index: false,
    languages: getLocaleAlternates("/alerts"),
  });
}

export default async function AlertsPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return (
    <div className="flex flex-col gap-6">
      <WorkspacePageHeading
        eyebrow={locale === "ko" ? "공지사항" : "Alerts"}
        title={
          locale === "ko"
            ? "학교 공지를 한 페이지에서 확인하세요."
            : "Review campus notices on one page."
        }
        description={
          locale === "ko"
            ? "카테고리 필터와 학과 구독을 확장 프로그램과 같은 흐름으로 사용할 수 있습니다."
            : "Use category filters and department subscriptions in the same flow as the extension."
        }
      />

      <WorkspaceAlerts locale={locale} />
    </div>
  );
}
