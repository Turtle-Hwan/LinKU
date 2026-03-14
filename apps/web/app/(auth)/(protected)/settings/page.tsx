import { createPageMetadata } from "@linku/seo";
import { SettingsPanel } from "@/components/settings-panel";
import { siteEnv } from "@/lib/site";
import { readWorkspaceState } from "@/lib/workspace-store";

export const metadata = createPageMetadata({
  title: "Settings",
  description: "Control the authenticated LinKU defaults for landing route, link behavior, and future notification-style preferences.",
  path: "/settings",
  siteUrl: siteEnv.siteUrl,
  index: false,
});

export default async function SettingsPage() {
  const state = await readWorkspaceState();

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Settings</p>
        <h1 data-display="true" className="text-5xl tracking-[-0.05em]">
          Keep the signed-in defaults explicit from the start.
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--muted)]">
          Even without a full backend yet, the settings interface is already separated behind a replaceable data
          boundary so we can swap storage implementations later.
        </p>
      </div>

      <SettingsPanel initialSettings={state.settings} />
    </div>
  );
}
