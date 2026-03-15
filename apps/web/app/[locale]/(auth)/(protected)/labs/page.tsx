import { createPageMetadata } from "@linku/seo";
import { WorkspaceLabs } from "@/components/workspace-labs";
import { getLocaleAlternates, getLocalizedPathname, resolveRouteParams } from "@/lib/intl";
import { siteEnv } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return createPageMetadata({
    title: locale === "ko" ? "Labs | LinKU" : "Labs | LinKU",
    description:
      locale === "ko"
        ? "도서관 좌석 현황, 서버 시계, QR 생성기를 LinKU web에서 함께 사용합니다."
        : "Use library seats, server clock, and QR generation inside LinKU web.",
    path: getLocalizedPathname("/labs", locale),
    imagePath: getLocalizedPathname("/opengraph-image", locale),
    siteUrl: siteEnv.siteUrl,
    index: false,
    languages: getLocaleAlternates("/labs"),
  });
}

export default async function LabsPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return <WorkspaceLabs locale={locale} />;
}
