import { createPageMetadata } from "@linku/seo";
import { LinksManager } from "@/components/links-manager";
import { siteEnv } from "@/lib/site";
import { readWorkspaceState } from "@/lib/workspace-store";

export const metadata = createPageMetadata({
  title: "Links",
  description: "Store personal shortcut links and reuse them across the authenticated LinKU surface.",
  path: "/links",
  siteUrl: siteEnv.siteUrl,
  index: false,
});

export default async function LinksPage() {
  const state = await readWorkspaceState();

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Links</p>
        <h1 data-display="true" className="text-5xl tracking-[-0.05em]">
          Personal shortcuts that sit beside the shared campus catalog.
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--muted)]">
          Use this space for the URLs you want to keep separate from the public services list, whether they are
          course pages, reference docs, or account-specific destinations.
        </p>
      </div>

      <LinksManager initialItems={state.links} />
    </div>
  );
}
