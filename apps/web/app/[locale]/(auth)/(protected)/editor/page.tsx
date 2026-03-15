import { resolveRouteParams } from "@/lib/intl";
import { WorkspaceTemplateEditor } from "@/components/workspace-template-editor";

export default async function EditorPage({
  params,
  searchParams,
}: {
  params?: Promise<{ locale?: string }>;
  searchParams?: Promise<{ source?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const resolvedSearchParams = (await searchParams) ?? {};
  const source = resolvedSearchParams.source === "default" ? "default" : "empty";

  return <WorkspaceTemplateEditor locale={locale} source={source} />;
}
