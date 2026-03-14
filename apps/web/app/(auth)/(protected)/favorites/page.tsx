import { SERVICES } from "@linku/core";
import { createPageMetadata } from "@linku/seo";
import { FavoritesManager } from "@/components/favorites-manager";
import { siteEnv } from "@/lib/site";
import { readWorkspaceState } from "@/lib/workspace-store";

export const metadata = createPageMetadata({
  title: "Favorites",
  description: "Save frequently revisited LinKU routes and service landing pages inside the authenticated web surface.",
  path: "/favorites",
  siteUrl: siteEnv.siteUrl,
  index: false,
});

export default async function FavoritesPage() {
  const state = await readWorkspaceState();

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Favorites</p>
        <h1 data-display="true" className="text-5xl tracking-[-0.05em]">
          Keep the routes you never want to re-find.
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--muted)]">
          This MVP stores favorites in a replaceable cookie-backed workspace layer so the interface is ready for a
          future database-backed implementation.
        </p>
      </div>

      <FavoritesManager
        initialItems={state.favorites}
        suggestions={SERVICES.map((service) => ({
          title: service.title,
          path: service.path,
        }))}
      />
    </div>
  );
}
