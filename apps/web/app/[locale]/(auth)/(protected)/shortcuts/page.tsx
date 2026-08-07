import { Button } from "@linku/ui";
import { createPageMetadata } from "@linku/seo";
import { WorkspaceLinks } from "@/components/workspace-links";
import { WorkspacePageHeading } from "@/components/workspace-page-heading";
import { Link } from "@/i18n/navigation";
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
    title: locale === "ko" ? "링크모음 | LinKU" : "Links | LinKU",
    description:
      locale === "ko"
        ? "확장 프로그램과 같은 건국대 캠퍼스 바로가기를 LinKU 웹에서 사용하세요."
        : "Use the same Konkuk campus shortcuts from the LinKU extension on the web.",
    path: getLocalizedPathname("/shortcuts", locale),
    imagePath: getLocalizedPathname("/opengraph-image", locale),
    siteUrl: siteEnv.siteUrl,
    index: false,
    languages: getLocaleAlternates("/shortcuts"),
  });
}

export default async function ShortcutsPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return (
    <div className="flex flex-col gap-6">
      <WorkspacePageHeading
        eyebrow={locale === "ko" ? "링크모음" : "Links"}
        title={
          locale === "ko"
            ? "확장에서 쓰던 바로가기를 웹에서도 그대로."
            : "The same shortcuts from the extension, now on the web."
        }
        description={
          locale === "ko"
            ? "적용한 템플릿 순서와 사용자 링크를 유지한 채 학교 서비스를 바로 엽니다."
            : "Open campus services using your active template order and custom links."
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/templates">
            {locale === "ko" ? "템플릿 관리" : "Manage templates"}
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/links">
            {locale === "ko" ? "내 링크 관리" : "Manage my links"}
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/favorites">
            {locale === "ko" ? "즐겨찾기 관리" : "Manage favorites"}
          </Link>
        </Button>
      </div>

      <WorkspaceLinks locale={locale} />
    </div>
  );
}
