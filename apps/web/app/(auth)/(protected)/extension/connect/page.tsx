import { createPageMetadata } from "@linku/seo";
import { ExtensionConnectCard } from "@/components/extension-connect-card";
import { siteEnv } from "@/lib/site";
import { readWorkspaceState } from "@/lib/workspace-store";

export const metadata = createPageMetadata({
  title: "Extension Connect",
  description: "Review and update the extension connection state from the same authenticated LinKU web surface.",
  path: "/extension/connect",
  siteUrl: siteEnv.siteUrl,
  index: false,
});

export default async function ExtensionConnectPage() {
  const state = await readWorkspaceState();

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Extension connect</p>
        <h1 data-display="true" className="text-5xl tracking-[-0.05em]">
          A path-based status page for extension handoff.
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--muted)]">
          The extension remains the privileged browser surface, but this route gives the signed-in user one place to
          confirm connection state without leaving the canonical web domain.
        </p>
      </div>

      <ExtensionConnectCard
        initialState={state.extension}
        defaultExtensionId={siteEnv.extensionId}
      />
    </div>
  );
}
