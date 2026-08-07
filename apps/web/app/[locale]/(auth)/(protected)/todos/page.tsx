import { createPageMetadata } from "@linku/seo";
import { WorkspacePageHeading } from "@/components/workspace-page-heading";
import { WorkspaceTodos } from "@/components/workspace-todos";
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
    title: "Todo | LinKU",
    description:
      locale === "ko"
        ? "개인 Todo와 eCampus 마감 일정을 LinKU 웹에서 함께 관리하세요."
        : "Manage personal todos and eCampus deadlines together in LinKU web.",
    path: getLocalizedPathname("/todos", locale),
    imagePath: getLocalizedPathname("/opengraph-image", locale),
    siteUrl: siteEnv.siteUrl,
    index: false,
    languages: getLocaleAlternates("/todos"),
  });
}

export default async function TodosPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return (
    <div className="flex flex-col gap-6">
      <WorkspacePageHeading
        eyebrow="Todo"
        title={
          locale === "ko"
            ? "개인 할 일과 eCampus 마감을 함께."
            : "Personal tasks and eCampus deadlines together."
        }
        description={
          locale === "ko"
            ? "추가, 완료, 삭제, D-Day 정렬과 Markdown 복사를 웹에서도 그대로 사용합니다."
            : "Add, complete, remove, sort by D-Day, and copy todos as Markdown."
        }
      />

      <div className="rounded-lg border bg-white p-4 sm:p-5">
        <WorkspaceTodos locale={locale} />
      </div>
    </div>
  );
}
