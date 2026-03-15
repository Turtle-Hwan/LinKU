import { auth } from "@/auth";
import { getLinkuBackendSnapshot } from "@/lib/linku-backend";
import { resolveRouteParams } from "@/lib/intl";
import { WorkspaceTemplateGallery } from "@/components/workspace-template-gallery";

export default async function GalleryPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const [session, backendSnapshot] = await Promise.all([
    auth(),
    getLinkuBackendSnapshot(),
  ]);

  return (
    <WorkspaceTemplateGallery
      locale={locale}
      backendConfigured={backendSnapshot.configured}
      backendConnected={backendSnapshot.connected}
      webSession={Boolean(session)}
    />
  );
}
