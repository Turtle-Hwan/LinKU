import Link from "next/link";
import { createPageMetadata } from "@linku/seo";
import { appNavLinks, siteEnv } from "@/lib/site";
import { readWorkspaceState } from "@/lib/workspace-store";

export const metadata = createPageMetadata({
  title: "Dashboard",
  description: "Review favorites, personal links, settings, and extension connection status inside the authenticated LinKU surface.",
  path: "/dashboard",
  siteUrl: siteEnv.siteUrl,
  index: false,
});

export default async function DashboardPage() {
  const state = await readWorkspaceState();

  const summaryCards = [
    { label: "Favorites", value: String(state.favorites.length) },
    { label: "Personal links", value: String(state.links.length) },
    {
      label: "Extension",
      value: state.extension.connected ? "Connected" : "Not connected",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Dashboard</p>
        <h1 data-display="true" className="text-5xl tracking-[-0.05em]">
          One authenticated surface, kept alongside the public SEO site.
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--muted)]">
          This dashboard is the signed-in home for the same Next.js app. Use it to organize favorites, personal
          links, settings, and extension status without splitting domains.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => (
          <article key={card.label} className="rounded-[1.4rem] border border-black/8 bg-white p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{card.label}</p>
            <h2 className="mt-3 text-4xl tracking-[-0.04em]">{card.value}</h2>
          </article>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {appNavLinks.map((item) => (
          <Link key={item.slug} href={item.path} className="rounded-[1.4rem] border border-black/8 bg-[#f6f0e1] p-5">
            <h2 className="text-2xl tracking-[-0.04em]">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.summary}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
