import { auth } from "@/auth";
import { resolveRouteParams } from "@/lib/intl";
import { getLinkuBackendSnapshot } from "@/lib/linku-backend";
import { WorkspaceTemplateManager } from "@/components/workspace-template-manager";

export default async function TemplatesPage({
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
    <WorkspaceTemplateManager
      locale={locale}
      remoteAccess={{
        webSession: Boolean(session),
        backendConfigured: backendSnapshot.configured,
        backendConnected: backendSnapshot.connected,
      }}
    />
  );
}
