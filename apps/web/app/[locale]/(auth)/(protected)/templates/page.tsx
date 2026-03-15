import { resolveRouteParams } from "@/lib/intl";
import { WorkspaceTemplateManager } from "@/components/workspace-template-manager";

export default async function TemplatesPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return <WorkspaceTemplateManager locale={locale} />;
}
