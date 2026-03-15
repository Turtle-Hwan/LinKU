import { resolveRouteParams } from "@/lib/intl";
import { WorkspaceTemplateGallery } from "@/components/workspace-template-gallery";

export default async function GalleryPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return <WorkspaceTemplateGallery locale={locale} />;
}
