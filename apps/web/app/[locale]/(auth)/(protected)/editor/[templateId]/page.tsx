import { resolveRouteParams } from "@/lib/intl";
import { WorkspaceTemplateEditor } from "@/components/workspace-template-editor";

export default async function TemplateEditorPage({
  params,
}: {
  params?: Promise<{ locale?: string; templateId?: string }>;
}) {
  const { locale, templateId } = await resolveRouteParams(params);

  return <WorkspaceTemplateEditor locale={locale} templateId={templateId} />;
}
