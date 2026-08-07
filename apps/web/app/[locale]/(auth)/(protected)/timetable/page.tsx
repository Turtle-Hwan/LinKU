import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@linku/ui";
import { createPageMetadata } from "@linku/seo";
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
    title: locale === "ko" ? "시간표 | LinKU" : "Timetable | LinKU",
    description:
      locale === "ko"
        ? "LinKU 시간표 기능의 현재 상태를 웹에서 확인하세요."
        : "Review the current LinKU timetable state on the web.",
    path: getLocalizedPathname("/timetable", locale),
    imagePath: getLocalizedPathname("/opengraph-image", locale),
    siteUrl: siteEnv.siteUrl,
    index: false,
    languages: getLocaleAlternates("/timetable"),
  });
}

export default async function TimetablePage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return (
    <div className="flex flex-col gap-6">
      <WorkspacePageHeading
        eyebrow={locale === "ko" ? "시간표" : "Timetable"}
        title={
          locale === "ko"
            ? "시간표를 위한 독립 공간입니다."
            : "A dedicated place for your timetable."
        }
        description={
          locale === "ko"
            ? "확장 프로그램의 현재 상태와 동일하게 준비 중 화면을 유지합니다."
            : "This keeps the same in-progress state currently shown by the extension."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "ko" ? "시간표는 준비 중입니다" : "Timetable is coming soon"}
          </CardTitle>
          <CardDescription>
            {locale === "ko"
              ? "메뉴와 페이지 구조를 먼저 분리해 이후 기능을 이 화면에 바로 연결할 수 있습니다."
              : "The route is now independent so the timetable can be connected here directly."}
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-48" />
      </Card>
    </div>
  );
}
